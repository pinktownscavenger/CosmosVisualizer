import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';

const containers = [];

export const mount = (element) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  containers.push(container);
  act(() => {
    ReactDOM.render(element, container);
  });
  return container;
};

export const unmountAll = () => {
  while (containers.length) {
    const container = containers.pop();
    ReactDOM.unmountComponentAtNode(container);
    container.remove();
  }
  document.body.innerHTML = '';
};
