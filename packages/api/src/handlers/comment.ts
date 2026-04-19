/**
 * Comment Handlers
 * HTTP handlers for comment operations
 */

import { Request, Response, NextFunction } from 'express';
import { CommentService } from '../services/comment';
import { z } from 'zod';

/**
 * Create comment handlers
 */
export const createCommentHandlers = (deps: { commentService: CommentService }) => {
  /**
   * POST /issues/:issueId/comments
   * Add comment to issue
   */
  const addComment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        issueId: z.string().cuid(),
      });

      const bodySchema = z.object({
        content: z.string().min(1).max(5000),
        mentions: z.array(z.string()).optional(),
      });

      const { issueId } = schema.parse(req.params);
      const body = bodySchema.parse(req.body);
      const userId = (req as any).userId as string;

      const comment = await deps.commentService.addComment(
        issueId,
        body.content,
        userId,
        body.mentions
      );

      res.status(201).json({
        success: true,
        data: comment,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /issues/:issueId/comments
   * Get comments for issue
   */
  const getComments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        issueId: z.string().cuid(),
      });

      const querySchema = z.object({
        limit: z.string().transform(Number).optional(),
        offset: z.string().transform(Number).optional(),
      });

      const { issueId } = schema.parse(req.params);
      const query = querySchema.parse(req.query);
      const userId = (req as any).userId as string;

      const result = await deps.commentService.getCommentsForIssue(
        issueId,
        userId,
        query.limit || 50,
        query.offset || 0
      );

      res.json({
        success: true,
        data: result.comments,
        pagination: {
          total: result.total,
          limit: query.limit || 50,
          offset: query.offset || 0,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /comments/:commentId
   * Update comment
   */
  const updateComment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        commentId: z.string().cuid(),
      });

      const bodySchema = z.object({
        content: z.string().min(1).max(5000),
        mentions: z.array(z.string()).optional(),
      });

      const { commentId } = schema.parse(req.params);
      const body = bodySchema.parse(req.body);
      const userId = (req as any).userId as string;

      const updated = await deps.commentService.updateComment(
        commentId,
        body.content,
        userId,
        body.mentions
      );

      res.json({
        success: true,
        data: updated,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /comments/:commentId
   * Delete comment
   */
  const deleteComment = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        commentId: z.string().cuid(),
      });

      const { commentId } = schema.parse(req.params);
      const userId = (req as any).userId as string;

      await deps.commentService.deleteComment(commentId, userId);

      res.json({
        success: true,
        message: 'Comment deleted',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /users/comments
   * Get user's comment history
   */
  const getUserComments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const querySchema = z.object({
        limit: z.string().transform(Number).optional(),
        offset: z.string().transform(Number).optional(),
      });

      const query = querySchema.parse(req.query);
      const userId = (req as any).userId as string;

      const comments = await deps.commentService.getUserComments(
        userId,
        query.limit || 20,
        query.offset || 0
      );

      res.json({
        success: true,
        data: comments,
        pagination: {
          limit: query.limit || 20,
          offset: query.offset || 0,
          count: comments.length,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /issues/:issueId/comments/search
   * Search comments
   */
  const searchComments = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        issueId: z.string().cuid(),
      });

      const querySchema = z.object({
        q: z.string().min(1).max(100),
        limit: z.string().transform(Number).optional(),
      });

      const { issueId } = schema.parse(req.params);
      const query = querySchema.parse(req.query);
      const userId = (req as any).userId as string;

      const comments = await deps.commentService.searchComments(
        issueId,
        query.q,
        userId,
        query.limit || 20
      );

      res.json({
        success: true,
        data: comments,
        searchTerm: query.q,
        count: comments.length,
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /workspaces/:workspaceId/activity
   * Get activity feed
   */
  const getActivityFeed = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const schema = z.object({
        workspaceId: z.string().cuid(),
      });

      const querySchema = z.object({
        limit: z.string().transform(Number).optional(),
        offset: z.string().transform(Number).optional(),
      });

      const { workspaceId } = schema.parse(req.params);
      const query = querySchema.parse(req.query);
      const userId = (req as any).userId as string;

      const comments = await deps.commentService.getActivityFeed(
        workspaceId,
        userId,
        query.limit || 50,
        query.offset || 0
      );

      res.json({
        success: true,
        data: comments,
        pagination: {
          limit: query.limit || 50,
          offset: query.offset || 0,
          count: comments.length,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  return {
    addComment,
    getComments,
    updateComment,
    deleteComment,
    getUserComments,
    searchComments,
    getActivityFeed,
  };
};

export type CommentHandlers = ReturnType<typeof createCommentHandlers>;
