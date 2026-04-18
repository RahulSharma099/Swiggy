// @pms/shared - Type definitions
export interface BaseEntity {
  id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Workspace extends BaseEntity {
  name: string;
  ownerId: string;
}

export interface Project extends BaseEntity {
  workspaceId: string;
  name: string;
  description?: string;
}

export interface Issue extends BaseEntity {
  projectId: string;
  title: string;
  description?: string;
  status: string;
}
