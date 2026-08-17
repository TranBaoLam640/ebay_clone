import { success } from '../../common/utils/api-response.js';
import * as service from './offer.service.js';

export const createOffer = async (req, res, next) => {
  try {
    const result = await service.createOffer({
      productUuid: req.validated.params.productId,
      buyerId: req.user.id,
      amount: req.validated.body.amount,
      quantity: req.validated.body.quantity,
      message: req.validated.body.message,
    });
    success(res, result, 201);
  } catch (error) {
    next(error);
  }
};

export const myOffers = async (req, res, next) => {
  try {
    success(res, await service.listMyOffers(req.user.id));
  } catch (error) {
    next(error);
  }
};

export const withdrawOffer = async (req, res, next) => {
  try {
    success(
      res,
      await service.withdrawOffer(req.user.id, req.validated.params.offerId),
    );
  } catch (error) {
    next(error);
  }
};

export const createConversationOffer = async (req, res, next) => {
  try {
    success(
      res,
      await service.createConversationOffer({
        conversationId: req.validated.params.id,
        userId: req.user.id,
        price: req.validated.body.price,
        message: req.validated.body.message,
      }),
      201,
    );
  } catch (error) {
    next(error);
  }
};

export const acceptOffer = async (req, res, next) => {
  try {
    success(
      res,
      await service.resolveOffer(req.user.id, req.validated.params.offerId, 'ACCEPTED'),
    );
  } catch (error) {
    next(error);
  }
};

export const declineOffer = async (req, res, next) => {
  try {
    success(
      res,
      await service.resolveOffer(req.user.id, req.validated.params.offerId, 'DECLINED'),
    );
  } catch (error) {
    next(error);
  }
};

export const counterOffer = async (req, res, next) => {
  try {
    success(
      res,
      await service.counterOffer({
        userId: req.user.id,
        offerId: req.validated.params.offerId,
        price: req.validated.body.price,
        message: req.validated.body.message,
      }),
      201,
    );
  } catch (error) {
    next(error);
  }
};
