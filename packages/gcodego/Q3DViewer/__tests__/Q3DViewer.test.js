'use strict';

import { mount } from '@vue/test-utils'
import Q3DViewer from '../../src/components/Q3DViewer.vue'

test('renders a todo', () => {
  const wrapper = mount(Q3DViewer)

  const todo = wrapper.get('[data-test="todo"]')

  expect(todo.text()).toBe('Learn Vue.js 3')
})