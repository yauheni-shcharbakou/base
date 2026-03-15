import { PUG_EXT_REG_EXP } from '@packages/grpc/compiler/constants';
import { dotCase, pascalCase, camelCase, constantCase, kebabCase } from 'change-case-all';
import { readdir, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import * as Pug from 'pug';
import { Project, Node, SourceFile } from 'ts-morph';

type ClientHostData = {
  name: string;
  services: {
    name: string;
    methods: {
      name: string;
      type: string;
      event: string;
    }[];
  }[];
};

const templatesPath = join(__dirname, 'templates');
const strategyFolderPath = join(__dirname, 'strategy');
const strategyFilePath = join(strategyFolderPath, 'index.ts');
const outputFolderPath = join(__dirname, 'generated');
const outputFilePath = join(outputFolderPath, 'index.ts');

const parseTemplates = async () => {
  const templateByName = new Map<string, Pug.compileTemplate>();
  const templateFiles = await readdir(templatesPath, { recursive: true });

  await Promise.all(
    templateFiles.map(async (templateFile) => {
      if (!templateFile.endsWith('.pug')) {
        return;
      }

      const pathToTemplate = join(templatesPath, templateFile);
      const templateContent = await readFile(pathToTemplate, { encoding: 'utf-8' });

      templateByName.set(
        templateFile.replace(PUG_EXT_REG_EXP, ''),
        Pug.compile(templateContent, { pretty: false }),
      );
    }),
  );

  return templateByName;
};

export const declareImports = (outputFile: SourceFile) => {
  outputFile.addImportDeclaration({
    moduleSpecifier: '@nestjs/common',
    namedImports: ['applyDecorators', 'Controller', 'UseInterceptors'],
  });

  outputFile.addImportDeclaration({
    moduleSpecifier: '@nestjs/microservices',
    namedImports: ['EventPattern'],
  });

  outputFile.addImportDeclaration({
    moduleSpecifier: '@nestjs-plugins/nestjs-nats-jetstream-transport',
    namedImports: ['NatsJetStreamContext', 'NatsJetStreamClientProxy'],
  });

  outputFile.addImportDeclaration({
    moduleSpecifier: 'rxjs',
    namedImports: ['Observable'],
  });

  outputFile.addImportDeclaration({
    moduleSpecifier: '../../interceptors',
    namedImports: ['NatsJsControllerInterceptor'],
  });

  outputFile.addImportDeclaration({
    moduleSpecifier: '../../utils',
    namedImports: ['globalStreamRegistry'],
  });
};

const compile = async () => {
  try {
    await rm(outputFolderPath, { recursive: true, force: true });
    await mkdir(outputFolderPath, { recursive: true });
    await writeFile(outputFilePath, '/* eslint-disable */\n', { encoding: 'utf8' });

    const templateByName = await parseTemplates();

    const project = new Project();
    const strategyFile = project.addSourceFileAtPath(strategyFilePath);
    const outputFile = project.addSourceFileAtPath(outputFilePath);

    project.addSourceFilesAtPaths(`${strategyFolderPath}/**/*.ts`);

    const strategy = strategyFile.getInterfaceOrThrow('NatsStrategy');

    declareImports(outputFile);

    const hostDataArray: ClientHostData[] = [];

    for (const host of strategy.getProperties()) {
      const hostName = host.getName();
      const hostType = host.getTypeNode();

      if (hostType && Node.isTypeLiteral(hostType)) {
        const hostProperties = hostType.getProperties();

        if (!hostProperties.length) {
          continue;
        }

        const hostData: ClientHostData = { name: hostName, services: [] };

        for (const service of hostProperties) {
          const serviceName = service.getName();
          const serviceType = service.getTypeNode();

          if (serviceType && Node.isTypeLiteral(serviceType)) {
            const serviceProperties = serviceType.getProperties();

            if (!serviceProperties.length) {
              continue;
            }

            hostData.services.push({ name: serviceName, methods: [] });
            const interfaceMap = new Map<string, { event: string; type: string }>();

            for (const event of serviceProperties) {
              const eventName = event.getName();
              const eventType = event.getType().getText();

              const fullEventName = dotCase(`${hostName}_${serviceName}_${eventName}`);

              interfaceMap.set(eventName, { event: fullEventName, type: eventType });

              hostData.services[hostData.services.length - 1].methods.push({
                name: eventName,
                event: fullEventName,
                type: eventType,
              });
            }

            outputFile.addStatements(
              templateByName.get('controller')({
                data: {
                  service: {
                    id: serviceName,
                    nameSpace: dotCase(`${hostName}_${serviceName}`),
                  },
                  methods: Array.from(interfaceMap.entries()).map(([name, { event, type }]) => {
                    return { name, event, type };
                  }),
                },
                pascalCase,
                camelCase,
                constantCase,
                dotCase,
                kebabCase,
              }),
            );
          }
        }

        hostDataArray.push(hostData);
      }
    }

    outputFile.addStatements(
      templateByName.get('client')({ data: { hosts: hostDataArray }, pascalCase }),
    );

    outputFile.organizeImports();
    await outputFile.save();
  } catch (e) {
    console.error('Error during nats strategy compilation:', e, e['stack']);
  }
};

compile().then();
