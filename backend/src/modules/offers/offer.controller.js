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
