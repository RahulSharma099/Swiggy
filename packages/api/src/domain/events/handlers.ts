import { AllDomainEvents } from "./types";
import { AuditService } from "../../services/audit";

/**
 * ActivityLogHandler
 * Persists domain events to ActivityLog table for audit trail and user feed
 */
export async function createActivityLogHandler(auditService: AuditService) {
  return async (event: AllDomainEvents): Promise<void> => {
    try {
      // Map domain events to audit log entries
      const actionMap: Record<string, string> = {
        "issue.created": "CREATED",
        "issue.updated": "UPDATED",
        "issue.deleted": "DELETED",
        "issue.moved": "MOVED",
        "issue.status_changed": "STATUS_CHANGED",
        "issue.assigned": "ASSIGNED",
        "comment.added": "COMMENT_ADDED",
        "comment.deleted": "COMMENT_DELETED",
        "sprint.created": "SPRINT_CREATED",
        "sprint.updated": "SPRINT_UPDATED",
        "sprint.started": "SPRINT_STARTED",
        "sprint.completed": "SPRINT_COMPLETED",
        "project.created": "PROJECT_CREATED",
        "project.updated": "PROJECT_UPDATED",
        "project.deleted": "PROJECT_DELETED",
        "workspace.created": "WORKSPACE_CREATED",
        "workflow.transition_applied": "TRANSITION_APPLIED",
      };

      const action = actionMap[event.type] || event.type.toUpperCase();

      // Determine the target entity based on aggregate type
      let targetEntityId = event.aggregateId;

      // Special handling for comments (aggregateId is comment_id, but we might want issue context)
      if (event.type === "comment.added" || event.type === "comment.deleted") {
        targetEntityId = (event.payload as any).issueId;
      }

      // Create audit log entry using the correct method name
      await (auditService as any).logIssueAction(
        targetEntityId,
        event.workspaceId,
        action,
        event.actorId,
        event.payload,
        `${event.type} event triggered`,
      );
    } catch (error) {
      console.error("Error writing activity log:", error);
      // Don't throw - activity log is non-critical
    }
  };
}

/**
 * WebSocketBroadcastHandler
 * Broadcasts events to connected WebSocket clients
 */
export async function createWebSocketBroadcastHandler(
  publisher: any, // WebSocketPublisher type
) {
  return async (event: AllDomainEvents): Promise<void> => {
    try {
      // Broadcast to workspace (all members see board updates)
      if (event.workspaceId) {
        await publisher.publishToWorkspace(event.workspaceId, {
          type: "event",
          eventType: event.type,
          aggregateId: event.aggregateId,
          aggregateType: event.aggregateType,
          payload: event.payload,
          timestamp: event.timestamp,
          correlationId: event.correlationId,
        });
      }

      // Broadcast to project (project-specific updates)
      if (event.projectId) {
        await publisher.publishToProject(event.projectId, {
          type: "event",
          eventType: event.type,
          aggregateId: event.aggregateId,
          aggregateType: event.aggregateType,
          payload: event.payload,
          timestamp: event.timestamp,
          correlationId: event.correlationId,
        });
      }

      // Broadcast to issue for comment updates
      if (event.type === "comment.added" || event.type === "comment.deleted") {
        const issueId = (event.payload as any).issueId;
        if (issueId) {
          await publisher.publishToIssue(issueId, {
            type: "event",
            eventType: event.type,
            data: event.payload,
            timestamp: event.timestamp,
          });
        }
      }

      // Sprint updates go to project scope
      if (
        event.type === "sprint.started" ||
        event.type === "sprint.completed" ||
        event.type === "sprint.created"
      ) {
        if (event.projectId) {
          await publisher.publishToProject(event.projectId, {
            type: "sprint_updated",
            sprintId: event.aggregateId,
            data: event.payload,
            timestamp: event.timestamp,
          });
        }
      }
    } catch (error) {
      console.error("Error broadcasting to WebSocket:", error);
      // Don't throw - WebSocket broadcast is non-critical
    }
  };
}

/**
 * SearchIndexHandler
 * Updates search cache/indices when issues or comments change
 */
export async function createSearchIndexHandler(
  cacheService: any, // SearchCacheService
) {
  return async (event: AllDomainEvents): Promise<void> => {
    try {
      // Invalidate search cache on mutations
      if (
        event.type === "issue.created" ||
        event.type === "issue.updated" ||
        event.type === "issue.deleted" ||
        event.type === "comment.added" ||
        event.type === "comment.deleted"
      ) {
        // Invalidate workspace search cache
        if (event.workspaceId) {
          await cacheService.invalidateWorkspaceSearchCache(event.workspaceId);
        }

        // Invalidate project search cache
        if (event.projectId) {
          await cacheService.invalidateProjectSearchCache(event.projectId);
        }
      }

      // Invalidate sprint cache on related events
      if (
        event.type === "sprint.started" ||
        event.type === "sprint.completed" ||
        event.type === "issue.moved"
      ) {
        if (event.projectId) {
          await cacheService.invalidateSprintCache(
            event.projectId,
            event.aggregateId,
          );
        }
      }
    } catch (error) {
      console.error("Error updating search index:", error);
      // Don't throw - search cache is non-critical
    }
  };
}

/**
 * NotificationQueueHandler
 * Enqueues notifications for users (email, in-app, etc)
 * Separates notification logic from core domain operations
 */
export async function createNotificationQueueHandler() {
  // notificationQueue: any // Would be queue service (Bull, RabbitMQ, etc)
  return async (event: AllDomainEvents): Promise<void> => {
    try {
      // These events trigger notifications
      const notifiableEvents = [
        "issue.assigned",
        "issue.status_changed",
        "comment.added",
        "issue.created",
      ];

      if (!notifiableEvents.includes(event.type)) {
        return;
      }

      // Queue notification job
      // TODO: Integrate with email/notification service
      // Examples:
      // - issue.assigned: Notify assignee
      // - comment.added: Notify watchers and issue assignee
      // - issue.status_changed: Notify watchers

      // For now, just log that we would notify
      console.log(`[NOTIFICATION] Would notify for event: ${event.type}`);
    } catch (error) {
      console.error("Error queueing notification:", error);
      // Don't throw - notifications are non-critical
    }
  };
}
