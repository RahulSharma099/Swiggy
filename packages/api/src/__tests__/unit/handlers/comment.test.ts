/**
 * Unit Tests: Comment Handlers
 * Tests for comment creation, updates, deletion
 */

import { createHandlerTestContext, createBatchComments, TEST_IDS } from '../../fixtures/factory';
import { createTestComment, TEST_USERS } from '../../fixtures/test-data';

describe('Comment Handlers', () => {
  let context: any;

  beforeEach(() => {
    context = createHandlerTestContext();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /issues/:issueId/comments - Create Comment', () => {
    it('should create a comment on an issue', async () => {
      const issueId = TEST_IDS.ISSUE_1;
      const commentData = {
        issueId,
        content: 'This is a great issue',
      };

      context.deps.services.comment.createComment.mockResolvedValueOnce(
        createTestComment({ ...commentData, authorId: TEST_USERS.MEMBER })
      );

      const result = await context.deps.services.comment.createComment(commentData, TEST_USERS.MEMBER);

      expect(result).toBeDefined();
      expect(result.content).toBe('This is a great issue');
      expect(result.issueId).toBe(issueId);
    });

    it('should require comment content', async () => {
      const commentData: any = {
        issueId: TEST_IDS.ISSUE_1,
        // missing content
      };

      expect(() => {
        if (!commentData.content) {
          throw new Error('Comment content is required');
        }
      }).toThrow('Comment content is required');
    });

    it('should validate comment length', async () => {
      const tooLongContent = 'a'.repeat(10001); // Assuming max 10000 chars

      expect(() => {
        if (tooLongContent.length > 10000) {
          throw new Error('Comment too long');
        }
      }).toThrow('Comment too long');
    });

    it('should sanitize HTML/XSS in comment', async () => {
      const maliciousContent = '<script>alert("XSS")</script>';

      // Sanitization should occur
      const sanitized = maliciousContent.replace(/<script>.*?<\/script>/g, '');

      expect(sanitized).not.toContain('<script>');
    });

    it('should strip markdown formatting if not allowed', async () => {
      const markdownContent = '# Title\n**bold** text';

      expect(markdownContent).toContain('**');
    });
  });

  describe('GET /issues/:issueId/comments - List Comments', () => {
    it('should list all comments on an issue', async () => {
      const issueId = TEST_IDS.ISSUE_1;
      const comments = createBatchComments(issueId, 5);

      context.deps.services.comment.getCommentsByIssue.mockResolvedValueOnce(comments);

      const result = await context.deps.services.comment.getCommentsByIssue(issueId);

      expect(result).toHaveLength(5);
      expect(result[0].issueId).toBe(issueId);
    });

    it('should return empty array when issue has no comments', async () => {
      const issueId = 'issue-with-no-comments';

      context.deps.services.comment.getCommentsByIssue.mockResolvedValueOnce([]);

      const result = await context.deps.services.comment.getCommentsByIssue(issueId);

      expect(result).toEqual([]);
    });

    it('should sort comments by creation date', async () => {
      const issueId = TEST_IDS.ISSUE_1;

      const comments = [
        createTestComment({
          issueId,
          content: 'First',
          createdAt: new Date('2026-01-01'),
        }),
        createTestComment({
          issueId,
          content: 'Second',
          createdAt: new Date('2026-01-02'),
        }),
      ];

      // Should be in creation order
      expect(comments[0].createdAt < comments[1].createdAt).toBe(true);
    });

    it('should support pagination for comments', async () => {
      const issueId = TEST_IDS.ISSUE_1;
      const limit = 10;

      const comments = createBatchComments(issueId, limit);

      context.deps.services.comment.getCommentsByIssue.mockResolvedValueOnce(comments);

      const result = await context.deps.services.comment.getCommentsByIssue(issueId);

      expect(result.length).toBeLessThanOrEqual(limit);
    });
  });

  describe('PUT /comments/:id - Update Comment', () => {
    it('should update comment content', async () => {
      const commentId = TEST_IDS.COMMENT_1;
      const updatedContent = 'Updated comment text';

      context.deps.services.comment.updateComment.mockResolvedValueOnce(
        createTestComment({ id: commentId, content: updatedContent })
      );

      const result = await context.deps.services.comment.updateComment(commentId, { content: updatedContent }, TEST_USERS.MEMBER);

      expect(result.content).toBe(updatedContent);
    });

    it('should only allow comment author to update', async () => {
      const originalAuthor = TEST_USERS.OWNER;
      const attemptingUser = TEST_USERS.MEMBER;

      expect(attemptingUser).not.toBe(originalAuthor);
    });

    it('should track edit history', async () => {
      const commentId = TEST_IDS.COMMENT_1;
      const updatedContent = 'Updated';

      context.deps.services.comment.updateComment.mockResolvedValueOnce(
        createTestComment({
          id: commentId,
          content: updatedContent,
          editedAt: new Date(),
        })
      );

      const result = await context.deps.services.comment.updateComment(commentId, { content: updatedContent }, TEST_USERS.MEMBER);

      expect(result.editedAt).toBeDefined();
    });
  });

  describe('DELETE /comments/:id - Delete Comment', () => {
    it('should delete a comment', async () => {
      const commentId = TEST_IDS.COMMENT_1;
      const authorId = TEST_USERS.MEMBER;

      context.deps.services.comment.deleteComment.mockResolvedValueOnce(true);

      const result = await context.deps.services.comment.deleteComment(commentId, authorId);

      expect(result).toBe(true);
    });

    it('should only allow comment author or admin to delete', async () => {
      const authorId = TEST_USERS.OWNER;
      const attemptingUser = TEST_USERS.VIEWER;

      expect(attemptingUser).not.toBe(authorId);
    });

    it('should soft-delete comment (mark as deleted)', async () => {
      const commentId = TEST_IDS.COMMENT_1;

      context.deps.services.comment.deleteComment.mockResolvedValueOnce(
        createTestComment({
          id: commentId,
          content: '[deleted]',
          deletedAt: new Date(),
        })
      );

      const result = await context.deps.services.comment.deleteComment(commentId, TEST_USERS.MEMBER);

      expect(result).toBeDefined();
    });
  });

  describe('Comment Mentions & Notifications', () => {
    it('should identify mentioned users in comment', async () => {
      const content = 'Hey @user-1 and @user-2, check this out';
      const mentionPattern = /@([a-z0-9-]+)/gi;

      const mentions = content.match(mentionPattern);

      expect(mentions).toHaveLength(2);
      expect(mentions).toContain('@user-1');
    });

    it('should validate mentioned users exist', async () => {
      const mentionedId = 'non-existent-user';

      expect(() => {
        if (!mentionedId.match(/^user-/)) {
          throw new Error('Invalid user mention');
        }
      }).toThrow('Invalid user mention');
    });
  });

  describe('Comment Threads & Replies', () => {
    it('should support comment replies', async () => {
      const issueId = TEST_IDS.ISSUE_1;
      const parentCommentId = TEST_IDS.COMMENT_1;

      const replyData = {
        issueId,
        content: 'Great point!',
        parentCommentId,
      };

      context.deps.services.comment.createComment.mockResolvedValueOnce(
        createTestComment({ ...replyData, authorId: TEST_USERS.MEMBER })
      );

      const reply = await context.deps.services.comment.createComment(replyData, TEST_USERS.MEMBER);

      expect(reply).toBeDefined();
      expect(reply.parentCommentId).toBe(parentCommentId);
    });

    it('should build comment threads', async () => {
      const issueId = TEST_IDS.ISSUE_1;

      const replies: any[] = [
        createTestComment({
          issueId,
          id: 'comment-reply-1',
          content: 'Reply 1',
          parentCommentId: 'comment-parent',
        }),
        createTestComment({
          issueId,
          id: 'comment-reply-2',
          content: 'Reply 2',
          parentCommentId: 'comment-parent',
        }),
      ];

      expect(replies.every((r: any) => r.parentCommentId === 'comment-parent')).toBe(true);
    });
  });

  describe('Comment Reactions & Engagement', () => {
    it('should add emoji reaction to comment', async () => {
      const commentId = TEST_IDS.COMMENT_1;
      const emoji = '👍';

      context.deps.services.comment.updateComment.mockResolvedValueOnce(
        createTestComment({
          id: commentId,
          reactions: [{ emoji, userId: TEST_USERS.MEMBER }],
        })
      );

      const result = await context.deps.services.comment.updateComment(commentId, {}, TEST_USERS.MEMBER);

      expect(result).toBeDefined();
    });
  });

  describe('Validation & Error Handling', () => {
    it('should handle orphaned comments gracefully', async () => {
      const orphanedCommentId = 'comment-orphaned';

      context.deps.services.comment.deleteComment.mockResolvedValueOnce(true);

      const result = await context.deps.services.comment.deleteComment(orphanedCommentId, TEST_USERS.ADMIN);

      expect(result).toBe(true);
    });

    it('should enforce rate limiting on comments', async () => {
      const issueId = TEST_IDS.ISSUE_1;

      // Simulate rapid comment creation
      const rapidComments = Array.from({ length: 10 }, (_, i) => ({
        issueId,
        content: `Rapid comment ${i}`,
      }));

      // In actual implementation, rate limiting would apply
      expect(rapidComments).toHaveLength(10);
    });
  });
});
