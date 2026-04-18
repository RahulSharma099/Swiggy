// @pms/shared - Utility functions
export const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
export const generateId = () => Math.random().toString(36).substring(2, 11);
