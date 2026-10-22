import { registerRootComponent } from 'expo';
import * as TaskManager from 'expo-task-manager';

import App from './App';
import { LOCATION_TASK, locationTaskExecutor } from './src/tracking/shift';

// defineTask va en el ámbito global: con la app en segundo plano solo corre este JS, sin montar vistas.
TaskManager.defineTask(LOCATION_TASK, locationTaskExecutor);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
