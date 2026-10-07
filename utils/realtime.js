const emitToAdmins = (event, payload = {}) => {
  try {
    if (global.__io__) global.__io__.to('admins').emit(event, payload);
  } catch (e) {
    console.error(`realtime.emitToAdmins(${event}) failed:`, e.message);
  }
};

const emitToUser = (userId, event, payload = {}) => {
  try {
    if (global.__io__ && userId) global.__io__.to(`user_${userId}`).emit(event, payload);
  } catch (e) {
    console.error(`realtime.emitToUser(${event}) failed:`, e.message);
  }
};

// Emit by Mongo _id — used to reach the customer who placed an order,
// because `Order.orderedBy` stores the customer's Mongo _id.
const emitToMongoUser = (mongoId, event, payload = {}) => {
  try {
    if (global.__io__ && mongoId) {
      global.__io__.to(`mongo_${mongoId}`).emit(event, payload);
    }
  } catch (e) {
    console.error(`realtime.emitToMongoUser(${event}) failed:`, e.message);
  }
};

const emitToConversation = (conversationId, event, payload = {}) => {
  try {
    if (global.__io__ && conversationId)
      global.__io__.to(`conv_${conversationId}`).emit(event, payload);
  } catch (e) {
    console.error(`realtime.emitToConversation(${event}) failed:`, e.message);
  }
};

// ✅ NEW — Broadcast to every connected customer.
const emitToCustomers = (event, payload = {}) => {
  try {
    if (global.__io__) global.__io__.to('customers').emit(event, payload);
  } catch (e) {
    console.error(`realtime.emitToCustomers(${event}) failed:`, e.message);
  }
};

// Notifies admins AND the specific customer in one call.
const emitOrderChanged = (order, action = 'updated') => {
  if (!order) return;
  const payload = {
    orderId: order.orderId,
    action,
    status: order.status,
    paymentStatus: order.paymentStatus,
    timestamp: new Date().toISOString(),
  };
  emitToAdmins('order:changed', payload);
  if (order.orderedBy) emitToMongoUser(order.orderedBy, 'order:changed', payload);
};

const emitInventoryChanged = (payload = {}) => {
  emitToAdmins('inventory:changed', {
    ...payload,
    timestamp: new Date().toISOString(),
  });
};


const emitProductChanged = (product, action = 'updated') => {
  if (!product) return;

  const productId = product.id;
  const timestamp = new Date().toISOString();

  // Admins keep the legacy channel — no admin code needs to change.
  emitToAdmins('inventory:changed', {
    reason: `product-${action}`,
    productId,
    timestamp,
  });


  let slim = null;
  if (action !== 'deleted') {
    const raw = typeof product.toObject === 'function'
      ? product.toObject()
      : product;
    const { stockMovements, ...rest } = raw;
    slim = rest;
  }

  emitToCustomers('product:changed', {
    action,
    productId,
    product: slim,
    timestamp,
  });
};

module.exports = {
  emitToAdmins,
  emitToUser,
  emitToMongoUser,
  emitToConversation,
  emitOrderChanged,
  emitInventoryChanged,
  emitToCustomers,      // ← ADD
  emitProductChanged,   // ← ADD
};