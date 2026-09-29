import React from 'react';
import ReactDOM from 'react-dom';
import { applyMiddleware, createStore, combineReducers, compose } from 'redux';
import { createLogger } from 'redux-logger';
import { Provider } from 'react-redux';

import { reducer as gremlinReducer } from './reducers/gremlinReducer';
import { reducer as graphReducer } from './reducers/graphReducer';
import { reducer as optionReducer } from './reducers/optionReducer';
import { reducer as connectionReducer } from './reducers/connectionReducer';
import { App } from './App';
import './styles.css';

const composeEnhancers = window.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ || compose;
const rootReducer = combineReducers({
  connection: connectionReducer,
  gremlin: gremlinReducer,
  graph: graphReducer,
  options: optionReducer
});
const middleware = process.env.NODE_ENV === 'development' ? [createLogger()] : [];

const store = createStore(
  rootReducer,
  composeEnhancers(applyMiddleware(...middleware))
);

ReactDOM.render(<Provider store={store}><App /></Provider>, document.getElementById('root'));
