import { success } from '../../common/utils/api-response.js';
import * as replacementChatService from './replacement-chat.service.js';

export const accept = async (req, res, next) => {
  try {
    success(
      res,
      await replacementChatService.accept(
        req.user.id,
        req.validated.params.replacementId,
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const decline = async (req, res, next) => {
  try {
    success(
      res,
      await replacementChatService.decline(
        req.user.id,
        req.validated.params.replacementId,
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const prepareShipment = async (req, res, next) => {
  try {
    success(
      res,
      await replacementChatService.prepareShipment(
        req.user.id,
        req.validated.params.replacementId,
      ),
      201,
    );
  } catch (error) {
    next(error);
  }
};

export const confirmReceived = async (req, res, next) => {
  try {
    success(
      res,
      await replacementChatService.confirmReceived(
        req.user.id,
        req.validated.params.replacementId,
      ),
    );
  } catch (error) {
    next(error);
  }
};
