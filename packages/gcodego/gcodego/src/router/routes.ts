import { RouteRecordRaw } from 'vue-router';
import Layout from 'layouts/MainLayout.vue'
import Home from 'pages/Index.vue'
import WorkBench from '../pages/Workbench.vue'
import Terminal from 'pages/Terminal.vue'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: Layout,
    children: [
      { path: '', component: Home },
      { name: 'workbench', path: 'workbench', component: WorkBench , props: true},
      { name: 'terminal', path: 'terminal', component: Terminal }
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
