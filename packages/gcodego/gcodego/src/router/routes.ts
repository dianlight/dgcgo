import { RouteRecordRaw } from 'vue-router';
import Layout from 'layouts/MainLayout.vue'
import PluginSubLayout from 'layouts/PluginSubLayout.vue'
import WorkBench from 'pages/Workbench.vue'
import Terminal from 'pages/Terminal.vue'
import TestPage from 'pages/TestPage.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: Layout,
    children: [
      { path: '', component: WorkBench },
      { name: 'workbench', path: 'workbench/:id?', component: WorkBench, props: true },
      { name: 'plugins', path: 'plugins/', component: PluginSubLayout, children: []},
      { name: 'terminal', path: 'terminal', component: Terminal },
      { name: 'testPage', path: 'testPage', component: TestPage }
    ],
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/Error404.vue'),
  },
];

export default routes;
