import axios from 'axios';

export const internalHttpClient = axios.create({ baseURL: '/api' });
