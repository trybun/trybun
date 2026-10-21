import { library } from './src/library.js';

export default [{ ignores: ['test/fixtures/**'] }, ...library()];
