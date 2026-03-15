import { NatsStreamConfig } from '@nestjs-plugins/nestjs-nats-jetstream-transport';
import _ from 'lodash';
import { NatsStreamData } from 'nats-js/nats-js.types';

export class NatsJsStreamRegistry {
  private readonly streamMap = new Map<string, Set<string>>();

  append(streamData: NatsStreamData) {
    const stream = this.streamMap.get(streamData.name);

    if (!stream) {
      this.streamMap.set(streamData.name, new Set(streamData.subjects));
      return;
    }

    _.forEach(streamData.subjects, (subject) => {
      stream.add(subject);
    });
  }

  getStreams(): NatsStreamConfig[] {
    return Array.from(this.streamMap.entries()).map(([name, subjects]) => {
      return {
        name,
        subjects: Array.from(subjects),
      };
    });
  }
}
