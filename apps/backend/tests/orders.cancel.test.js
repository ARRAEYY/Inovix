const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { ORDER_STATUS } = require('../src/lib/constants');
const ordersService = require('../src/modules/orders/orders.service');
const ordersRepo = require('../src/modules/orders/orders.repository');

describe('Student Order Cancellation Rules', () => {
  test('student can cancel an order while it is in PENDING state', async (t) => {
    const studentId = 'student-123';
    const orderId = 'order-pending-1';

    t.mock.method(ordersRepo, 'findById', async (id) => ({
      id,
      studentId,
      status: ORDER_STATUS.PENDING,
      totalAmount: 250,
    }));

    t.mock.method(ordersRepo, 'updateStatus', async (id, expectedStatus, targetStatus, actorId, extra) => {
      assert.strictEqual(expectedStatus, ORDER_STATUS.PENDING);
      assert.strictEqual(targetStatus, ORDER_STATUS.CANCELLED);
      assert.strictEqual(actorId, studentId);
      return {
        id,
        studentId,
        status: ORDER_STATUS.CANCELLED,
        cancelReason: extra.reason,
      };
    });

    const { updated, before } = await ordersService.cancelOrder(studentId, orderId);
    assert.strictEqual(before.status, ORDER_STATUS.PENDING);
    assert.strictEqual(updated.status, ORDER_STATUS.CANCELLED);
  });

  test('student cannot cancel an order once it is ACCEPTED', async (t) => {
    const studentId = 'student-123';
    const orderId = 'order-accepted-1';

    t.mock.method(ordersRepo, 'findById', async (id) => ({
      id,
      studentId,
      status: ORDER_STATUS.ACCEPTED,
    }));

    await assert.rejects(
      async () => ordersService.cancelOrder(studentId, orderId),
      (err) => {
        assert.strictEqual(err.statusCode, 400);
        assert.match(err.message, /before the outlet accepts/);
        return true;
      }
    );
  });

  test('student cannot cancel an order in PREPARING, READY, or COMPLETED state', async (t) => {
    const studentId = 'student-123';

    for (const status of [ORDER_STATUS.PREPARING, ORDER_STATUS.READY, ORDER_STATUS.COMPLETED]) {
      t.mock.method(ordersRepo, 'findById', async (id) => ({
        id: `order-${status}`,
        studentId,
        status,
      }));

      await assert.rejects(
        async () => ordersService.cancelOrder(studentId, `order-${status}`),
        (err) => {
          assert.strictEqual(err.statusCode, 400);
          assert.match(err.message, /before the outlet accepts/);
          return true;
        }
      );
    }
  });

  test('student cannot cancel an order belonging to another student', async (t) => {
    const studentId = 'student-123';
    const otherStudentId = 'student-999';
    const orderId = 'order-other-1';

    t.mock.method(ordersRepo, 'findById', async (id) => ({
      id,
      studentId: otherStudentId,
      status: ORDER_STATUS.PENDING,
    }));

    await assert.rejects(
      async () => ordersService.cancelOrder(studentId, orderId),
      (err) => {
        assert.strictEqual(err.statusCode, 403);
        assert.match(err.message, /not authorized/);
        return true;
      }
    );
  });
});
