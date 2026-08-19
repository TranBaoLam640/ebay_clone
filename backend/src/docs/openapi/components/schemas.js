const objectId = {
  type: 'string',
  pattern: '^[a-fA-F0-9]{24}$',
  example: '64b7f1c2e4b0a123456789ab',
};
const timestamp = {
  type: 'string',
  format: 'date-time',
  example: '2026-07-21T10:30:00.000Z',
};
const nullableTimestamp = { ...timestamp, nullable: true };
const productUuid = {
  type: 'string',
  format: 'uuid',
  example: '11111111-1111-4111-a111-111111111111',
};
const rating = { type: 'integer', minimum: 1, maximum: 5, example: 5 };
const password = {
  type: 'string',
  format: 'password',
  minLength: 8,
  example: 'Buyer#2026',
};
const addressFields = {
  recipientName: { type: 'string', minLength: 1, example: 'Nguyen Van An' },
  phone: { type: 'string', minLength: 1, example: '0901234567' },
  addressLine: { type: 'string', minLength: 1, example: '123 Nguyen Hue' },
  ward: { type: 'string', minLength: 1, example: 'Ben Nghe' },
  district: { type: 'string', minLength: 1, example: 'District 1' },
  province: { type: 'string', minLength: 1, example: 'Ho Chi Minh City' },
  country: { type: 'string', minLength: 1, example: 'Vietnam' },
  postalCode: { type: 'string', example: '700000' },
  isDefault: { type: 'boolean', example: true },
};
const feedbackFields = {
  commentType: {
    type: 'string',
    enum: ['POSITIVE', 'NEUTRAL', 'NEGATIVE'],
    example: 'POSITIVE',
  },
  commentText: {
    type: 'string',
    maxLength: 500,
    example: 'Excellent transaction.',
  },
  rating,
  comment: {
    type: 'string',
    maxLength: 2000,
    deprecated: true,
    example: 'Excellent transaction.',
  },
  itemAsDescribedRating: rating,
  communicationRating: rating,
  shippingTimeRating: rating,
  shippingAndHandlingChargesRating: rating,
  shippingRating: { ...rating, deprecated: true },
};
const feedbackImage = {
  type: 'object',
  required: ['key', 'url'],
  properties: {
    key: { type: 'string', example: 'seller-feedbacks/image-id.jpg' },
    url: { type: 'string', format: 'uri' },
  },
};
const sellerSummary = {
  type: 'object',
  required: ['id', 'displayName', 'averageFeedbackRating', 'feedbackCount'],
  properties: {
    id: objectId,
    displayName: { type: 'string' },
    avatarUrl: { type: 'string', format: 'uri', nullable: true },
    averageFeedbackRating: { type: 'number', minimum: 0, maximum: 5 },
    feedbackCount: { type: 'integer', minimum: 0 },
  },
};
const categorySummary = {
  type: 'object',
  required: ['id', 'name', 'slug'],
  properties: {
    id: objectId,
    name: { type: 'string' },
    slug: { type: 'string' },
  },
};

export const schemas = {
  ObjectId: objectId,
  SuccessEnvelope: {
    type: 'object',
    required: ['success', 'data'],
    properties: { success: { type: 'boolean', enum: [true] }, data: {} },
  },
  ErrorDetail: {
    type: 'object',
    additionalProperties: false,
    properties: {
      path: {
        type: 'array',
        items: { oneOf: [{ type: 'string' }, { type: 'integer' }] },
        example: ['body', 'email'],
      },
      message: { type: 'string', example: 'Invalid email address' },
    },
  },
  ErrorEnvelope: {
    type: 'object',
    required: ['success', 'error'],
    properties: {
      success: { type: 'boolean', enum: [false] },
      error: {
        type: 'object',
        required: ['code', 'message', 'details', 'requestId'],
        properties: {
          code: { type: 'string', example: 'VALIDATION_ERROR' },
          message: { type: 'string', example: 'Validation failed' },
          details: {
            type: 'array',
            items: { $ref: '#/components/schemas/ErrorDetail' },
          },
          requestId: { type: 'string', example: 'req_01JABCDEF' },
        },
      },
    },
  },
  PaginationMeta: {
    type: 'object',
    required: ['page', 'limit', 'totalItems', 'totalPages'],
    properties: {
      page: { type: 'integer', minimum: 1 },
      limit: { type: 'integer', minimum: 1 },
      totalItems: { type: 'integer', minimum: 0 },
      totalPages: { type: 'integer', minimum: 0 },
    },
  },
  HealthStatus: {
    type: 'object',
    required: ['status'],
    properties: { status: { type: 'string', enum: ['ok'] } },
  },
  ReadinessStatus: {
    type: 'object',
    required: ['status'],
    properties: { status: { type: 'string', enum: ['ready', 'not_ready'] } },
  },
  CsrfTokenResponse: {
    type: 'object',
    required: ['csrfToken'],
    properties: { csrfToken: { type: 'string', example: 'fake-csrf-token' } },
  },
  RegisterRequest: {
    type: 'object',
    required: ['email', 'password', 'fullName'],
    properties: {
      email: { type: 'string', format: 'email', example: 'buyer@example.test' },
      password,
      fullName: { type: 'string', minLength: 1, example: 'Nguyen Van An' },
    },
  },
  LoginRequest: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email', example: 'buyer@example.test' },
      password: { type: 'string', format: 'password', example: 'Buyer#2026' },
    },
  },
  VerifyEmailRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['email', 'otp'],
    properties: {
      email: { type: 'string', format: 'email', example: 'buyer@example.test' },
      otp: {
        type: 'string',
        pattern: '^\\d{6}$',
        example: '042731',
      },
    },
  },
  ResendVerificationRequest: {
    type: 'object',
    required: ['email'],
    properties: {
      email: { type: 'string', format: 'email', example: 'buyer@example.test' },
    },
  },
  UpdateProfileRequest: {
    type: 'object',
    additionalProperties: false,
    properties: {
      fullName: { type: 'string', minLength: 1 },
      phone: { type: 'string' },
      avatarUrl: { type: 'string', format: 'uri' },
    },
  },
  ChangePasswordRequest: {
    type: 'object',
    required: ['currentPassword', 'newPassword'],
    properties: {
      currentPassword: { type: 'string', format: 'password' },
      newPassword: password,
    },
  },
  CreateAddressRequest: {
    type: 'object',
    required: [
      'recipientName',
      'phone',
      'addressLine',
      'ward',
      'district',
      'province',
      'country',
    ],
    properties: addressFields,
  },
  UpdateAddressRequest: {
    type: 'object',
    additionalProperties: false,
    properties: addressFields,
  },
  CreateProductReviewRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['orderId', 'orderItemId', 'rating'],
    properties: {
      orderId: objectId,
      orderItemId: objectId,
      rating,
      comment: { type: 'string', maxLength: 2000 },
    },
  },
  CreateOrderItemProductReviewRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['rating'],
    properties: {
      rating,
      comment: { type: 'string', maxLength: 2000 },
    },
  },
  UpdateProductReviewRequest: {
    type: 'object',
    minProperties: 1,
    additionalProperties: false,
    properties: { rating, comment: { type: 'string', maxLength: 2000 } },
  },
  CreateSellerFeedbackRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['commentType'],
    properties: feedbackFields,
  },
  CreateLegacySellerFeedbackRequest: {
    type: 'object',
    additionalProperties: false,
    properties: feedbackFields,
    description:
      'Legacy whole-order route. Prefer the order-item-scoped endpoint.',
  },
  SellerFeedbackResponseRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['commentText'],
    properties: {
      commentText: { type: 'string', minLength: 1, maxLength: 500 },
    },
  },
  SellerFeedbackFollowUpRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['commentText'],
    properties: {
      commentText: { type: 'string', minLength: 1, maxLength: 500 },
    },
    description:
      'One immutable buyer follow-up comment. Does not change commentType, original commentText, DSR, images, submittedAt, or revision state.',
  },
  CreateFeedbackRevisionRequest: {
    type: 'object',
    additionalProperties: false,
    description:
      'Empty body. Sellers may request one revision for BUYER neutral/negative feedback within 30 days of submittedAt.',
  },
  FeedbackRevisionDecisionRequest: {
    oneOf: [
      {
        type: 'object',
        additionalProperties: false,
        required: ['decision', 'feedback'],
        properties: {
          decision: { type: 'string', enum: ['ACCEPT'] },
          feedback: {
            type: 'object',
            additionalProperties: false,
            required: ['commentType'],
            properties: {
              commentType: {
                type: 'string',
                enum: ['POSITIVE', 'NEUTRAL', 'NEGATIVE'],
              },
              commentText: { type: 'string', maxLength: 500 },
              itemAsDescribedRating: rating,
              communicationRating: rating,
              shippingTimeRating: rating,
              shippingAndHandlingChargesRating: rating,
            },
            description:
              'Replacement canonical feedback fields only. Images and transaction identity are unchanged.',
          },
        },
      },
      {
        type: 'object',
        additionalProperties: false,
        required: ['decision'],
        properties: {
          decision: { type: 'string', enum: ['DECLINE'] },
        },
      },
    ],
  },
  UpdateSellerFeedbackRequest: {
    type: 'object',
    deprecated: true,
    minProperties: 1,
    additionalProperties: false,
    properties: feedbackFields,
    description:
      'Deprecated. Submitted BUYER feedback cannot be edited directly; revision ACCEPT is the only supported path for changing canonical feedback fields.',
  },
  UserProfile: {
    type: 'object',
    properties: {
      _id: objectId,
      email: { type: 'string', format: 'email' },
      fullName: { type: 'string' },
      phone: { type: 'string', nullable: true },
      avatarUrl: { type: 'string', format: 'uri', nullable: true },
      role: { type: 'string', enum: ['USER', 'ADMIN'] },
      status: { type: 'string' },
      isEmailVerified: { type: 'boolean' },
      sellerProfile: {
        type: 'object',
        nullable: true,
        properties: { id: objectId },
        description:
          'Present when this USER owns a SellerProfile. Normal buyers receive null.',
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  },
  Address: {
    type: 'object',
    properties: {
      _id: objectId,
      userId: objectId,
      ...addressFields,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  },
  Notification: {
    type: 'object',
    properties: {
      _id: objectId,
      userId: objectId,
      type: {
        type: 'string',
        enum: ['ACCOUNT', 'ORDER', 'PAYMENT', 'RETURN', 'PROMOTION', 'SYSTEM'],
      },
      title: { type: 'string' },
      message: { type: 'string' },
      referenceType: { type: 'string' },
      referenceId: objectId,
      isRead: { type: 'boolean' },
      readAt: nullableTimestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  },
  Category: {
    type: 'object',
    properties: {
      _id: objectId,
      name: { type: 'string' },
      slug: { type: 'string' },
      description: { type: 'string' },
      parentId: { ...objectId, nullable: true },
      status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  },
  SellerProfile: {
    type: 'object',
    properties: {
      id: objectId,
      displayName: { type: 'string' },
      avatarUrl: { type: 'string', format: 'uri', nullable: true },
      description: { type: 'string' },
      averageFeedbackRating: { type: 'number', minimum: 0, maximum: 5 },
      feedbackCount: { type: 'integer', minimum: 0 },
    },
  },
  ProductAttribute: {
    type: 'object',
    required: ['name', 'normalizedName', 'value', 'dataType'],
    properties: {
      name: {
        type: 'string',
        example: 'Color',
        description:
          'Attribute label, for example Color, RAM, Released, or Refurbished.',
      },
      normalizedName: {
        type: 'string',
        example: 'color',
        description:
          'Normalized label, for example color, ram, released, or refurbished.',
      },
      value: {
        oneOf: [
          { type: 'string', example: 'Midnight Blue' },
          { type: 'number', example: 16 },
          { type: 'boolean', example: true },
          {
            type: 'string',
            format: 'date-time',
            example: '2026-01-15T00:00:00.000Z',
          },
        ],
      },
      dataType: {
        type: 'string',
        enum: ['string', 'number', 'boolean', 'date'],
      },
      unit: { type: 'string', example: 'GB' },
    },
  },
  ProductReview: {
    type: 'object',
    properties: {
      id: objectId,
      productId: objectId,
      catalogProductId: objectId,
      ePID: {
        type: 'string',
        example: 'SBAY-EPID-0001',
        description: 'Project-local eBay-style catalog product identifier.',
      },
      rating,
      comment: { type: 'string' },
      verifiedPurchase: {
        type: 'boolean',
        readOnly: true,
        example: true,
      },
      reviewer: {
        type: 'object',
        properties: {
          fullName: { type: 'string' },
          avatarUrl: { type: 'string', format: 'uri', nullable: true },
        },
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  },
  ProductReviewSummary: {
    type: 'object',
    required: ['averageRating', 'reviewCount', 'ratingHistogram'],
    properties: {
      averageRating: {
        type: 'number',
        nullable: true,
        minimum: 0,
        maximum: 5,
      },
      reviewCount: { type: 'integer', minimum: 0 },
      ratingHistogram: {
        type: 'object',
        required: ['1', '2', '3', '4', '5'],
        properties: {
          1: { type: 'integer', minimum: 0 },
          2: { type: 'integer', minimum: 0 },
          3: { type: 'integer', minimum: 0 },
          4: { type: 'integer', minimum: 0 },
          5: { type: 'integer', minimum: 0 },
        },
      },
    },
  },
  ProductRatingSummary: {
    type: 'object',
    required: ['averageRating', 'reviewCount'],
    properties: {
      averageRating: {
        type: 'number',
        nullable: true,
        minimum: 0,
        maximum: 5,
      },
      reviewCount: { type: 'integer', minimum: 0 },
    },
  },
  CatalogProduct: {
    type: 'object',
    required: ['id', 'ePID', 'name'],
    properties: {
      id: objectId,
      ePID: {
        type: 'string',
        example: 'SBAY-EPID-0001',
        description: 'Project-local eBay-style catalog product identifier.',
      },
      name: { type: 'string' },
      brand: { type: 'string', nullable: true },
      model: { type: 'string', nullable: true },
      categoryId: objectId,
      imageUrl: { type: 'string', format: 'uri', nullable: true },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  },
  ProductListItem: {
    type: 'object',
    required: [
      'id',
      'title',
      'price',
      'stock',
      'status',
      'averageRating',
      'reviewCount',
      'seller',
      'category',
    ],
    properties: {
      id: objectId,
      title: { type: 'string' },
      primaryImage: { type: 'string', format: 'uri', nullable: true },
      price: { type: 'integer', minimum: 0 },
      stock: { type: 'integer', minimum: 0 },
      status: { type: 'string', enum: ['ACTIVE', 'OUT_OF_STOCK'] },
      averageRating: { type: 'number', minimum: 0, maximum: 5 },
      reviewCount: { type: 'integer', minimum: 0 },
      reviewSummary: { $ref: '#/components/schemas/ProductRatingSummary' },
      catalogProduct: {
        allOf: [{ $ref: '#/components/schemas/CatalogProduct' }],
        nullable: true,
      },
      seller: sellerSummary,
      category: categorySummary,
    },
  },
  ProductDetail: {
    type: 'object',
    required: [
      'id',
      'title',
      'description',
      'price',
      'stock',
      'status',
      'images',
      'attributes',
      'averageRating',
      'reviewCount',
      'seller',
      'category',
      'recentReviews',
    ],
    properties: {
      id: objectId,
      title: { type: 'string' },
      description: { type: 'string' },
      price: { type: 'integer', minimum: 0 },
      stock: { type: 'integer', minimum: 0 },
      status: { type: 'string', enum: ['ACTIVE', 'OUT_OF_STOCK'] },
      images: { type: 'array', items: { type: 'string', format: 'uri' } },
      attributes: {
        type: 'array',
        items: { $ref: '#/components/schemas/ProductAttribute' },
      },
      averageRating: { type: 'number', minimum: 0, maximum: 5 },
      reviewCount: { type: 'integer', minimum: 0 },
      reviewSummary: { $ref: '#/components/schemas/ProductRatingSummary' },
      catalogProduct: {
        allOf: [{ $ref: '#/components/schemas/CatalogProduct' }],
        nullable: true,
      },
      seller: sellerSummary,
      category: categorySummary,
      recentReviews: {
        type: 'array',
        maxItems: 5,
        items: { $ref: '#/components/schemas/ProductReview' },
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  },
  SellerFeedback: {
    type: 'object',
    properties: {
      id: objectId,
      orderId: objectId,
      orderItemId: objectId,
      sellerId: objectId,
      productId: objectId,
      commentType: {
        type: 'string',
        enum: ['POSITIVE', 'NEUTRAL', 'NEGATIVE'],
      },
      commentText: { type: 'string', maxLength: 500 },
      source: {
        type: 'string',
        enum: ['BUYER', 'AUTOMATED'],
        description:
          'Server-controlled. AUTOMATED is created only by the backend 2-minute demo sweep.',
      },
      verifiedPurchase: {
        type: 'boolean',
        readOnly: true,
        description:
          'Read-only server-derived flag for transaction-backed SellerFeedback.',
      },
      submittedAt: {
        ...timestamp,
        description:
          'Effective feedback submission timestamp. Legacy records fall back to createdAt.',
      },
      rating,
      comment: { type: 'string', deprecated: true },
      itemAsDescribedRating: rating,
      communicationRating: rating,
      shippingTimeRating: rating,
      shippingAndHandlingChargesRating: rating,
      shippingRating: { ...rating, deprecated: true },
      images: {
        type: 'array',
        maxItems: 5,
        items: feedbackImage,
      },
      followUpComment: {
        type: 'object',
        nullable: true,
        description:
          'One immutable buyer follow-up comment. It is separate from revision and never changes canonical feedback fields.',
        properties: {
          commentText: { type: 'string', maxLength: 500 },
          createdAt: timestamp,
        },
      },
      sellerResponse: {
        type: 'object',
        nullable: true,
        properties: {
          commentText: { type: 'string', maxLength: 500 },
          createdAt: timestamp,
        },
      },
      revisionRequest: {
        type: 'object',
        nullable: true,
        description:
          'One request total per feedback. PENDING expires after 10 days; expired pending requests are exposed as EXPIRED.',
        properties: {
          status: {
            type: 'string',
            enum: ['PENDING', 'ACCEPTED', 'DECLINED', 'EXPIRED'],
          },
          requestedAt: timestamp,
          expiresAt: timestamp,
          respondedAt: nullableTimestamp,
        },
      },
      buyer: { type: 'object', properties: { fullName: { type: 'string' } } },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  },
  SellerFeedbackLookup: {
    type: 'object',
    properties: {
      exists: { type: 'boolean' },
      feedback: { $ref: '#/components/schemas/SellerFeedback' },
    },
  },
  AwaitingSellerFeedbackItem: {
    type: 'object',
    properties: {
      orderId: objectId,
      orderItemId: objectId,
      productId: objectId,
      sellerId: objectId,
      quantity: { type: 'integer', minimum: 1 },
      title: { type: 'string' },
      image: { type: 'string', nullable: true },
      unitPrice: { type: 'integer', minimum: 0 },
      itemSubtotal: { type: 'integer', minimum: 0 },
      product: {
        type: 'object',
        nullable: true,
        properties: {
          id: productUuid,
          title: { type: 'string' },
          primaryImage: { type: 'string', format: 'uri', nullable: true },
        },
      },
      seller: sellerSummary,
      eligibleForSellerFeedback: { type: 'boolean' },
      feedbackDeadline: timestamp,
      deliveredAt: nullableTimestamp,
      createdAt: timestamp,
    },
  },
  SellerFeedbackSummary: {
    type: 'object',
    properties: {
      sellerId: objectId,
      totalFeedbackCount: { type: 'integer', minimum: 0 },
      legacyAverageFeedbackRating: {
        type: 'number',
        minimum: 0,
        maximum: 5,
      },
      counts: {
        type: 'object',
        properties: {
          POSITIVE: { type: 'integer', minimum: 0 },
          NEUTRAL: { type: 'integer', minimum: 0 },
          NEGATIVE: { type: 'integer', minimum: 0 },
        },
      },
      averageDetailedSellerRatings: {
        type: 'object',
        properties: {
          itemAsDescribed: { type: 'number', nullable: true },
          communication: { type: 'number', nullable: true },
          shippingTime: { type: 'number', nullable: true },
          shippingAndHandlingCharges: { type: 'number', nullable: true },
        },
      },
    },
  },
  CartSeller: {
    type: 'object',
    required: ['id', 'displayName'],
    properties: {
      id: objectId,
      displayName: { type: 'string', example: 'Alpha Store' },
    },
  },
  CartProduct: {
    type: 'object',
    required: [
      'id',
      'title',
      'primaryImage',
      'price',
      'stock',
      'status',
      'seller',
    ],
    properties: {
      id: objectId,
      title: { type: 'string', nullable: true },
      primaryImage: { type: 'string', format: 'uri', nullable: true },
      price: { type: 'integer', minimum: 0, nullable: true },
      stock: { type: 'integer', minimum: 0 },
      status: {
        type: 'string',
        enum: ['ACTIVE', 'OUT_OF_STOCK', 'UNAVAILABLE'],
      },
      seller: {
        allOf: [{ $ref: '#/components/schemas/CartSeller' }],
        nullable: true,
      },
    },
  },
  CartItem: {
    type: 'object',
    required: ['id', 'productId', 'product', 'quantity', 'itemSubtotal'],
    properties: {
      id: objectId,
      productId: objectId,
      product: { $ref: '#/components/schemas/CartProduct' },
      quantity: { type: 'integer', minimum: 1 },
      itemSubtotal: { type: 'integer', minimum: 0 },
    },
  },
  Cart: {
    type: 'object',
    required: ['id', 'items', 'subtotal', 'totalQuantity'],
    properties: {
      id: { ...objectId, nullable: true },
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/CartItem' },
      },
      subtotal: { type: 'integer', minimum: 0 },
      totalQuantity: { type: 'integer', minimum: 0 },
    },
  },
  CartItemRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['productId', 'quantity'],
    properties: {
      productId: objectId,
      quantity: { type: 'integer', minimum: 1 },
    },
  },
  UpdateCartItemRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['quantity'],
    properties: { quantity: { type: 'integer', minimum: 1 } },
  },
  CartSyncRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['items'],
    properties: {
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/CartItemRequest' },
      },
    },
  },
  CartSyncWarning: {
    type: 'object',
    required: ['code', 'productId', 'requested', 'final'],
    properties: {
      code: {
        type: 'string',
        enum: [
          'DUPLICATE_LOCAL_ITEM_NORMALIZED',
          'PRODUCT_UNAVAILABLE',
          'PRODUCT_OUT_OF_STOCK',
          'QUANTITY_ADJUSTED',
        ],
      },
      productId: objectId,
      requested: { type: 'integer', minimum: 0 },
      final: { type: 'integer', minimum: 0 },
    },
  },
  CartSyncResult: {
    allOf: [
      { $ref: '#/components/schemas/Cart' },
      {
        type: 'object',
        required: ['warnings'],
        properties: {
          warnings: {
            type: 'array',
            items: { $ref: '#/components/schemas/CartSyncWarning' },
          },
        },
      },
    ],
  },
  CartSelectionRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['selectedCartItemIds'],
    properties: {
      selectedCartItemIds: {
        type: 'array',
        minItems: 1,
        items: objectId,
      },
    },
  },
  CouponValidationRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['code', 'selectedCartItemIds'],
    properties: {
      code: { type: 'string', minLength: 1, example: 'SAVE10' },
      selectedCartItemIds: {
        type: 'array',
        minItems: 1,
        items: objectId,
      },
    },
  },
  CouponEvaluation: {
    type: 'object',
    required: [
      'couponId',
      'code',
      'discountType',
      'discountValue',
      'perUserLimit',
      'subtotal',
      'discount',
    ],
    properties: {
      couponId: objectId,
      code: { type: 'string', example: 'SAVE10' },
      discountType: {
        type: 'string',
        enum: ['PERCENTAGE', 'FIXED_AMOUNT'],
      },
      discountValue: { type: 'integer', minimum: 1 },
      perUserLimit: { type: 'integer', minimum: 1, nullable: true },
      subtotal: { type: 'integer', minimum: 0 },
      discount: { type: 'integer', minimum: 0 },
    },
  },
  CheckoutRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['selectedCartItemIds', 'addressId', 'paymentMethod'],
    properties: {
      selectedCartItemIds: {
        type: 'array',
        minItems: 1,
        items: objectId,
      },
      addressId: objectId,
      couponCode: { type: 'string', minLength: 1, example: 'SAVE10' },
      paymentMethod: { type: 'string', enum: ['COD', 'PAYPAL'] },
      offerId: {
        ...objectId,
        description:
          'Accepted offer to apply to checkout. Requires exactly one selected cart item whose product, seller, and quantity match the offer.',
      },
    },
  },
  AddressSnapshot: {
    type: 'object',
    required: [
      'fullName',
      'phone',
      'addressLine',
      'ward',
      'district',
      'province',
      'country',
    ],
    properties: {
      fullName: { type: 'string' },
      phone: { type: 'string' },
      addressLine: { type: 'string' },
      ward: { type: 'string' },
      district: { type: 'string' },
      province: { type: 'string' },
      country: { type: 'string' },
      postalCode: { type: 'string' },
    },
  },
  CheckoutSellerGroup: {
    type: 'object',
    required: [
      'sellerId',
      'sellerDisplayName',
      'items',
      'subtotal',
      'discount',
      'total',
    ],
    properties: {
      sellerId: objectId,
      sellerDisplayName: { type: 'string' },
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/CartItem' },
      },
      subtotal: { type: 'integer', minimum: 0 },
      discount: { type: 'integer', minimum: 0 },
      total: { type: 'integer', minimum: 0 },
    },
  },
  CheckoutOfferSummary: {
    type: 'object',
    required: ['id', 'originalPrice', 'finalPrice'],
    properties: {
      id: objectId,
      originalPrice: { type: 'integer', minimum: 0 },
      finalPrice: { type: 'integer', minimum: 0 },
    },
  },
  CheckoutPreview: {
    type: 'object',
    required: [
      'selectedItems',
      'sellerGroups',
      'address',
      'subtotal',
      'discount',
      'total',
      'stockWarnings',
      'paymentMethods',
      'selectedPaymentMethod',
      'currency',
      'shippingFee',
      'coupon',
    ],
    properties: {
      selectedItems: {
        type: 'array',
        items: { $ref: '#/components/schemas/CartItem' },
      },
      sellerGroups: {
        type: 'array',
        items: { $ref: '#/components/schemas/CheckoutSellerGroup' },
      },
      address: { $ref: '#/components/schemas/AddressSnapshot' },
      subtotal: { type: 'integer', minimum: 0 },
      discount: { type: 'integer', minimum: 0 },
      total: { type: 'integer', minimum: 0 },
      stockWarnings: { type: 'array', items: { type: 'object' } },
      paymentMethods: {
        type: 'array',
        items: { type: 'string', enum: ['COD', 'PAYPAL'] },
      },
      selectedPaymentMethod: { type: 'string', enum: ['COD', 'PAYPAL'] },
      currency: { type: 'string', enum: ['VND'] },
      shippingFee: { type: 'integer', minimum: 0 },
      coupon: {
        allOf: [{ $ref: '#/components/schemas/CouponEvaluation' }],
        nullable: true,
      },
      offer: {
        allOf: [{ $ref: '#/components/schemas/CheckoutOfferSummary' }],
        nullable: true,
      },
    },
  },
  OrderItem: {
    type: 'object',
    required: ['_id', 'productId', 'sellerId', 'quantity'],
    properties: {
      _id: objectId,
      productId: objectId,
      sellerId: objectId,
      quantity: { type: 'integer', minimum: 1 },
      title: { type: 'string' },
      unitPrice: { type: 'integer', minimum: 0 },
      itemSubtotal: { type: 'integer', minimum: 0 },
      offerId: objectId,
      originalPrice: { type: 'integer', minimum: 0 },
      finalPrice: { type: 'integer', minimum: 0 },
    },
  },
  Order: {
    type: 'object',
    required: [
      '_id',
      'sellerId',
      'orderStatus',
      'items',
      'createdAt',
      'updatedAt',
    ],
    properties: {
      _id: objectId,
      sellerId: objectId,
      checkoutGroupId: objectId,
      orderStatus: {
        type: 'string',
        enum: ['PENDING_PAYMENT', 'CONFIRMED', 'PAYMENT_FAILED', 'DELIVERED'],
      },
      paymentMethod: { type: 'string', enum: ['COD', 'PAYPAL'] },
      subtotal: { type: 'integer', minimum: 0 },
      discount: { type: 'integer', minimum: 0 },
      shippingFee: { type: 'integer', minimum: 0 },
      total: { type: 'integer', minimum: 0 },
      currency: { type: 'string', enum: ['VND'] },
      shippingAddress: { $ref: '#/components/schemas/AddressSnapshot' },
      deliveredAt: timestamp,
      offerId: objectId,
      items: {
        type: 'array',
        items: { $ref: '#/components/schemas/OrderItem' },
      },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  },
  Payment: {
    type: 'object',
    required: [
      '_id',
      'checkoutGroupId',
      'method',
      'status',
      'amount',
      'currency',
      'createdAt',
      'updatedAt',
    ],
    properties: {
      _id: objectId,
      checkoutGroupId: objectId,
      method: { type: 'string', enum: ['COD', 'PAYPAL'] },
      status: {
        type: 'string',
        enum: [
          'PENDING',
          'PROVIDER_CREATING',
          'CREATED',
          'PROVIDER_CAPTURING',
          'CONFIRMED',
          'CAPTURED',
          'FAILED',
        ],
      },
      amount: { type: 'integer', minimum: 0 },
      currency: { type: 'string', enum: ['VND'] },
      providerOrderId: { type: 'string' },
      failureReason: { type: 'string' },
      capturedAt: timestamp,
      confirmedAt: timestamp,
      failedAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  },
  CheckoutGroup: {
    type: 'object',
    required: [
      '_id',
      'orderIds',
      'paymentId',
      'couponId',
      'paymentMethod',
      'status',
      'subtotal',
      'discount',
      'shippingFee',
      'total',
      'currency',
      'createdAt',
      'updatedAt',
    ],
    properties: {
      _id: objectId,
      orderIds: { type: 'array', items: objectId },
      paymentId: objectId,
      couponId: { ...objectId, nullable: true },
      paymentMethod: { type: 'string', enum: ['COD', 'PAYPAL'] },
      status: {
        type: 'string',
        enum: ['CONFIRMED', 'PAYMENT_PENDING', 'PAYMENT_FAILED'],
      },
      subtotal: { type: 'integer', minimum: 0 },
      discount: { type: 'integer', minimum: 0 },
      shippingFee: { type: 'integer', minimum: 0 },
      total: { type: 'integer', minimum: 0 },
      currency: { type: 'string', enum: ['VND'] },
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  },
  CheckoutGroupDetail: {
    allOf: [
      { $ref: '#/components/schemas/CheckoutGroup' },
      {
        type: 'object',
        required: ['orders', 'payment'],
        properties: {
          orders: {
            type: 'array',
            items: { $ref: '#/components/schemas/Order' },
          },
          payment: { $ref: '#/components/schemas/Payment' },
        },
      },
    ],
  },
  PaymentActionRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['checkoutGroupId'],
    properties: { checkoutGroupId: objectId },
  },
  MessageAttachment: {
    type: 'object',
    additionalProperties: false,
    required: ['url', 'mimeType'],
    properties: {
      url: { type: 'string', format: 'uri' },
      fileName: { type: 'string', maxLength: 255 },
      mimeType: { type: 'string', maxLength: 120 },
      size: { type: 'integer', minimum: 0, maximum: 10485760 },
      type: { type: 'string', enum: ['IMAGE', 'FILE'] },
    },
  },
  Offer: {
    type: 'object',
    required: [
      'id',
      'conversationId',
      'productId',
      'buyerId',
      'sellerId',
      'createdBy',
      'originalPrice',
      'offerPrice',
      'amount',
      'quantity',
      'status',
      'parentOfferId',
      'expiresAt',
      'createdAt',
    ],
    properties: {
      id: objectId,
      conversationId: { ...objectId, nullable: true },
      productId: objectId,
      buyerId: objectId,
      sellerId: { ...objectId, nullable: true },
      createdBy: { ...objectId, nullable: true },
      originalPrice: { type: 'integer', minimum: 0 },
      offerPrice: { type: 'integer', minimum: 1 },
      amount: { type: 'integer', minimum: 1 },
      quantity: { type: 'integer', minimum: 1, maximum: 999 },
      message: { type: 'string', maxLength: 500 },
      status: {
        type: 'string',
        enum: [
          'PENDING',
          'ACCEPTED',
          'DECLINED',
          'COUNTERED',
          'EXPIRED',
          'WITHDRAWN',
          'PURCHASED',
        ],
      },
      parentOfferId: { ...objectId, nullable: true },
      orderId: { ...objectId, nullable: true },
      usedAt: nullableTimestamp,
      expiresAt: timestamp,
      createdAt: timestamp,
    },
  },
  CreateProductOfferRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['amount'],
    properties: {
      amount: { type: 'integer', minimum: 1 },
      quantity: { type: 'integer', minimum: 1, maximum: 999 },
      message: { type: 'string', maxLength: 500 },
    },
  },
  ConversationOfferRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['price'],
    properties: {
      price: { type: 'integer', minimum: 1 },
      message: { type: 'string', maxLength: 500 },
    },
  },
  ConversationProductSummary: {
    type: 'object',
    required: ['id', 'title', 'image', 'price', 'offersEnabled'],
    properties: {
      id: productUuid,
      title: { type: 'string' },
      image: { type: 'string', format: 'uri', nullable: true },
      price: { type: 'integer', minimum: 0 },
      status: { type: 'string' },
      offersEnabled: { type: 'boolean' },
    },
  },
  ConversationSellerSummary: {
    type: 'object',
    required: ['id', 'displayName', 'avatarUrl', 'feedbackScore'],
    properties: {
      id: objectId,
      displayName: { type: 'string' },
      username: { type: 'string', nullable: true },
      email: { type: 'string', format: 'email', nullable: true },
      avatarUrl: { type: 'string', format: 'uri', nullable: true },
      feedbackScore: { type: 'integer', minimum: 0 },
    },
  },
  ConversationLastMessage: {
    type: 'object',
    required: ['id', 'type', 'content', 'status', 'createdAt'],
    properties: {
      id: objectId,
      type: {
        type: 'string',
        enum: ['TEXT', 'IMAGE', 'FILE', 'OFFER', 'SYSTEM'],
      },
      content: { type: 'string', nullable: true },
      status: { type: 'string', enum: ['SENT', 'DELIVERED', 'READ'] },
      createdAt: timestamp,
    },
  },
  Conversation: {
    type: 'object',
    required: [
      'id',
      'type',
      'status',
      'role',
      'product',
      'seller',
      'orderId',
      'lastMessage',
      'unreadCount',
      'lastMessageAt',
      'createdAt',
    ],
    properties: {
      id: objectId,
      type: { type: 'string', enum: ['PRE_PURCHASE', 'POST_PURCHASE'] },
      status: { type: 'string', enum: ['ACTIVE', 'ARCHIVED'] },
      role: { type: 'string', enum: ['BUYER', 'SELLER'] },
      product: { $ref: '#/components/schemas/ConversationProductSummary' },
      seller: { $ref: '#/components/schemas/ConversationSellerSummary' },
      orderId: { ...objectId, nullable: true },
      lastMessage: {
        allOf: [{ $ref: '#/components/schemas/ConversationLastMessage' }],
        nullable: true,
      },
      unreadCount: { type: 'integer', minimum: 0 },
      lastMessageAt: timestamp,
      createdAt: timestamp,
    },
  },
  ConversationMessage: {
    type: 'object',
    required: [
      'id',
      'conversationId',
      'senderId',
      'type',
      'content',
      'attachments',
      'status',
      'createdAt',
    ],
    properties: {
      id: objectId,
      conversationId: objectId,
      senderId: objectId,
      sender: {
        type: 'object',
        nullable: true,
        properties: {
          id: objectId,
          displayName: { type: 'string' },
          username: { type: 'string', nullable: true },
          avatarUrl: { type: 'string', format: 'uri', nullable: true },
        },
      },
      clientMessageId: { type: 'string', maxLength: 100 },
      type: {
        type: 'string',
        enum: ['TEXT', 'IMAGE', 'FILE', 'OFFER', 'SYSTEM'],
      },
      content: { type: 'string', nullable: true, maxLength: 4000 },
      attachments: {
        type: 'array',
        maxItems: 5,
        items: { $ref: '#/components/schemas/MessageAttachment' },
      },
      offer: {
        allOf: [{ $ref: '#/components/schemas/Offer' }],
        nullable: true,
      },
      status: { type: 'string', enum: ['SENT', 'DELIVERED', 'READ'] },
      createdAt: timestamp,
    },
  },
  CreateConversationRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['productId'],
    properties: {
      productId: productUuid,
      orderId: objectId,
    },
  },
  SendMessageRequest: {
    type: 'object',
    additionalProperties: false,
    properties: {
      type: {
        type: 'string',
        enum: ['TEXT', 'IMAGE', 'FILE'],
        default: 'TEXT',
      },
      clientMessageId: { type: 'string', maxLength: 100 },
      content: { type: 'string', maxLength: 4000 },
      attachments: {
        type: 'array',
        maxItems: 5,
        items: { $ref: '#/components/schemas/MessageAttachment' },
        default: [],
      },
      sendCopyToEmail: { type: 'boolean', default: false },
    },
  },
  AttachmentUploadResponse: {
    type: 'array',
    items: { $ref: '#/components/schemas/MessageAttachment' },
  },
  ConversationUpdatedEvent: {
    type: 'object',
    required: ['id', 'type', 'orderId'],
    properties: {
      id: objectId,
      type: { type: 'string', enum: ['PRE_PURCHASE', 'POST_PURCHASE'] },
      orderId: { ...objectId, nullable: true },
      updatedAt: timestamp,
      lastMessage: { $ref: '#/components/schemas/ConversationMessage' },
    },
  },
  OfferUpdatedEvent: { $ref: '#/components/schemas/Offer' },
  CreateReturnRequest: {
    type: 'object',
    additionalProperties: false,
    required: ['orderId', 'orderItemId', 'quantity', 'reason'],
    properties: {
      orderId: objectId,
      orderItemId: objectId,
      quantity: { type: 'integer', minimum: 1 },
      reason: {
        type: 'string',
        enum: [
          'DAMAGED',
          'DEFECTIVE',
          'WRONG_ITEM',
          'NOT_AS_DESCRIBED',
          'MISSING_PARTS',
          'CHANGED_MIND',
          'OTHER',
        ],
      },
      details: { type: 'string', minLength: 1, maxLength: 1000 },
    },
  },
  ReturnRequest: {
    type: 'object',
    required: [
      '_id',
      'orderId',
      'sellerId',
      'orderItemId',
      'productId',
      'quantity',
      'reason',
      'status',
      'createdAt',
      'updatedAt',
    ],
    properties: {
      _id: objectId,
      orderId: objectId,
      sellerId: objectId,
      orderItemId: objectId,
      productId: objectId,
      quantity: { type: 'integer', minimum: 1 },
      reason: {
        type: 'string',
        enum: [
          'DAMAGED',
          'DEFECTIVE',
          'WRONG_ITEM',
          'NOT_AS_DESCRIBED',
          'MISSING_PARTS',
          'CHANGED_MIND',
          'OTHER',
        ],
      },
      details: { type: 'string', maxLength: 1000 },
      status: {
        type: 'string',
        enum: ['REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED'],
      },
      cancelledAt: timestamp,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  },
};
