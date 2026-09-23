const emitToAdmins = (event, payload = {}) => {
  try {
    const rooms = global.__io__?.sockets?.adapter?.rooms;
    const adminRoom = rooms?.get('admins');
    const count = adminRoom ? adminRoom.size : 0;
    console.log(`📡 [realtime] → admins | ${event} | listeners in room: ${count}`);
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
      const room = `mongo_${mongoId}`;
      const listeners = global.__io__?.sockets?.adapter?.rooms?.get(room)?.size || 0;
      console.log(`📡 [realtime] → ${room} | ${event} | listeners: ${listeners}`);
      global.__io__.to(room).emit(event, payload);
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

module.exports = {
  emitToAdmins,
  emitToUser,
  emitToMongoUser,
  emitToConversation,
  emitOrderChanged,
  emitInventoryChanged,
};