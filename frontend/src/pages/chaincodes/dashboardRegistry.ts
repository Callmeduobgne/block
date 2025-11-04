import { ComponentType } from 'react';
import TeaTraceDashboard from './TeaTraceDashboard';
import GenericChaincodeDashboard from './GenericChaincodeDashboard';

interface DashboardComponent {
  component: ComponentType<{ chaincode: any }>;
  name: string;
  description: string;
}

/**
 * Dashboard Registry - Map chaincode names to their specialized dashboards
 * If a chaincode doesn't have a specialized dashboard, it will use the Generic Dashboard
 */
export const dashboardRegistry: Record<string, DashboardComponent> = {
  'teaTraceCC': {
    component: TeaTraceDashboard,
    name: 'Tea Traceability Dashboard',
    description: 'Dashboard chuyên biệt cho quản lý truy xuất nguồn gốc trà'
  },
  // Add more specialized dashboards here as needed
  // 'supplyChainCC': {
  //   component: SupplyChainDashboard,
  //   name: 'Supply Chain Dashboard',
  //   description: 'Dashboard for supply chain management'
  // },
};

/**
 * Get dashboard component for a given chaincode
 * Falls back to Generic Dashboard if no specialized dashboard exists
 */
export const getDashboardForChaincode = (chaincodeName: string): DashboardComponent => {
  return dashboardRegistry[chaincodeName] || {
    component: GenericChaincodeDashboard,
    name: 'Generic Chaincode Dashboard',
    description: 'Dashboard tổng quát cho tất cả các chaincode'
  };
};

/**
 * Check if a chaincode has a specialized dashboard
 */
export const hasSpecializedDashboard = (chaincodeName: string): boolean => {
  return chaincodeName in dashboardRegistry;
};

