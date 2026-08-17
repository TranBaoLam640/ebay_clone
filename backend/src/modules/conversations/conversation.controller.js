import { success } from '../../common/utils/api-response.js';
import * as service from './conversation.service.js';

export const listConversations = async (req, res, next) => {
  try {
    success(res, await service.list(req.user.id, req.validated.query));
  } catch (error) {
    next(error);
  }
};

export const createConversation = async (req, res, next) => {
  try {
    success(res, await service.createOrGet(req.user.id, req.validated.body), 201);
  } catch (error) {
    next(error);
  }
};

export const getMessages = async (req, res, next) => {
  try {
    success(
      res,
      await service.messages(
        req.user.id,
        req.validated.params.id,
        req.validated.query,
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const sendMessage = async (req, res, next) => {
  try {
    success(
      res,
      await service.sendMessage(
        req.user.id,
        req.validated.params.id,
        req.validated.body,
      ),
      201,
    );
  } catch (error) {
    next(error);
  }
};

export const uploadAttachments = async (req, res, next) => {
  try {
    success(
      res,
      await service.uploadAttachments(
        req.user.id,
        req.params.id,
        req.files || [],
      ),
      201,
    );
  } catch (error) {
    next(error);
  }
};

export const markRead = async (req, res, next) => {
  try {
    success(res, await service.markRead(req.user.id, req.validated.params.id));
  } catch (error) {
    next(error);
  }
};

export const archive = async (req, res, next) => {
  try {
    success(res, await service.archive(req.user.id, req.validated.params.id));
  } catch (error) {
    next(error);
  }
};
