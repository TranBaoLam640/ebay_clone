import { success } from '../../common/utils/api-response.js';
import * as service from './auction.service.js';

export const placeBid = async (req, res, next) => {
  try {
    const result = await service.placeBid({
      productUuid: req.validated.params.productId,
      bidderId: req.user.id,
      maxBid: req.validated.body.maxBid,
    });
    success(res, result, 201);
  } catch (error) {
    next(error);
  }
};

export const bidHistory = async (req, res, next) => {
  try {
    success(
      res,
      await service.getBidHistory(
        req.validated.params.productId,
        req.user?.id ?? null,
      ),
    );
  } catch (error) {
    next(error);
  }
};

export const bidStatus = async (req, res, next) => {
  try {
    success(
      res,
      await service.getBidStatus(req.validated.params.productId, req.user.id),
    );
  } catch (error) {
    next(error);
  }
};

export const buyNow = async (req, res, next) => {
  try {
    const result = await service.buyNow({
      productUuid: req.validated.params.productId,
      buyerId: req.user.id,
    });
    success(res, result, 201);
  } catch (error) {
    next(error);
  }
};

export const myBids = async (req, res, next) => {
  try {
    success(res, await service.listMyBids(req.user.id));
  } catch (error) {
    next(error);
  }
};
