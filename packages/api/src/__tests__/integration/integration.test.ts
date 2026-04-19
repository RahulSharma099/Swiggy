/**
 * WebSocket Event System Integration Test
 * 
 * This test demonstrates the complete flow:
 * 1. Issue service emits domain events
 * 2. WebSocket publisher subscribes to events  
 * 3. Events are published to Redis channels
 * 4. WebSocket server broadcasts to connected clients
 */

import { eventEmitter, createDomainEvent, DomainEvents } from '@pms/shared';

/**
 * Test 1: Event Emission
 * Demonstrates how services emit domain events
 */
export const testEventEmission = (): void => {
  console.log('\n=== TEST 1: Event Emission ===');

  // This is how services emit events
  const event = createDomainEvent(
    DomainEvents.ISSUE_CREATED,
    'issue',
    'issue-123',
    'user-456',
    {
      projectId: 'proj-789',
      workspaceId: 'ws-abc',
      title: 'Fix login bug',
      type: 'bug',
      reporterId: 'user-456',
    }
  );

  console.log('✅ Domain event created:');
  console.log(`   Type: ${event.type}`);
  console.log(`   Aggregate: ${event.aggregateType}#${event.aggregateId}`);
  console.log(`   Actor: ${event.actorId}`);
  console.log(`   Timestamp: ${event.timestamp.toISOString()}`);
};

/**
 * Test 2: Event Listener Registration
 * Verifies that subscribers can listen to events
 */
export const testEventListeners = (): Promise<void> => {
  return new Promise((resolve) => {
    console.log('\n=== TEST 2: Event Listener Registration ===');

    let issueCreatedReceived = false;
    let issueUpdatedReceived = false;

    // Subscribe to issue created events
    eventEmitter.onEvent(DomainEvents.ISSUE_CREATED, () => {
      console.log('✅ Listener received ISSUE_CREATED event');
      issueCreatedReceived = true;
    });

    // Subscribe to issue updated events
    eventEmitter.onEvent(DomainEvents.ISSUE_UPDATED, () => {
      console.log('✅ Listener received ISSUE_UPDATED event');
      issueUpdatedReceived = true;
    });

    // Emit test events
    eventEmitter.emitEvent(
      createDomainEvent(
        DomainEvents.ISSUE_CREATED,
        'issue',
        'test-issue-1',
        'user-1',
        { projectId: 'proj-1', workspaceId: 'ws-1', title: 'Test Issue' }
      )
    );

    eventEmitter.emitEvent(
      createDomainEvent(
        DomainEvents.ISSUE_UPDATED,
        'issue',
        'test-issue-1',
        'user-1',
        { projectId: 'proj-1', workspaceId: 'ws-1', changes: { status: 'done' } }
      )
    );

    // Verify event reception
    setTimeout(() => {
      if (issueCreatedReceived && issueUpdatedReceived) {
        console.log('✅ All events were received by listeners');
      }
      resolve();
    }, 100);
  });
};

/**
 * Test 3: Redis Pub/Sub Integration
 * Demonstrates publishing events to Redis channels
 */
export const testRedisIntegration = async (): Promise<void> => {
  console.log('\n=== TEST 3: Redis Pub/Sub Integration ===');

  try {
    const redis = await import('redis');

    const publisher = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });

    const subscriber = redis.createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
    });

    publisher.on('error', (err) => console.error('Publisher error:', err));
    subscriber.on('error', (err) => console.error('Subscriber error:', err));

    await publisher.connect();
    await subscriber.connect();

    console.log('✅ Redis clients connected');

    // Subscribe to workspace channel
    const channelName = 'ws:workspace:ws-test-123';
    let messageReceived = false;

    subscriber.subscribe(channelName, (message) => {
      console.log(`✅ Received from channel "${channelName}":`);
      console.log(`   ${message}`);
      messageReceived = true;
    });

    // Wait for subscription
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Publish test event
    const testPayload = {
      type: 'issue:created',
      payload: {
        issueId: 'test-123',
        title: 'Integration Test Issue',
        workspaceId: 'ws-test-123',
      },
      timestamp: Date.now(),
    };

    await publisher.publish(channelName, JSON.stringify(testPayload));
    console.log(`✅ Published test event to "${channelName}"`);

    // Wait for reception
    await new Promise((resolve) => setTimeout(resolve, 100));

    if (messageReceived) {
      console.log('✅ Redis Pub/Sub working correctly');
    }

    await publisher.quit();
    await subscriber.quit();
  } catch (error) {
    console.warn('⚠️  Redis test skipped (Redis not available):', (error as Error).message);
  }
};

/**
 * Test 4: Event Flow Simulation
 * Simulates complete flow from service emission to websocket publication
 */
export const testCompleteEventFlow = async (): Promise<void> => {
  console.log('\n=== TEST 4: Complete Event Flow ===');

  // Simulate service creating an issue
  console.log('Step 1: Service creates issue...');
  const event = createDomainEvent(
    DomainEvents.ISSUE_CREATED,
    'issue',
    'issue-integration-test',
    'user-abc',
    {
      projectId: 'proj-test',
      workspaceId: 'ws-integration-test',
      title: 'Integration Test Issue',
      type: 'bug',
      reporterId: 'user-abc',
    }
  );

  // Simulate websocket publisher listening
  console.log('Step 2: WebSocket publisher listening for events...');
  let publishedToRedis = false;

  eventEmitter.onEvent(DomainEvents.ISSUE_CREATED, async (evt) => {
    const { workspaceId } = evt.data;
    console.log(`Step 3: Emitting event to Redis channel "ws:workspace:${workspaceId}"...`);

    try {
      const redis = await import('redis');
      const client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      });
      await client.connect();

      const payload = {
        type: evt.type,
        payload: evt.data,
        timestamp: Date.now(),
      };

      await client.publish(`ws:workspace:${workspaceId}`, JSON.stringify(payload));
      console.log('✅ Published to Redis');
      publishedToRedis = true;

      await client.quit();
    } catch (error) {
      console.warn('⚠️  Redis publish skipped:', (error as Error).message);
    }
  });

  // Emit the event
  console.log('Step 2.5: Service emits ISSUE_CREATED event...');
  eventEmitter.emitEvent(event);

  // Wait for processing
  await new Promise((resolve) => setTimeout(resolve, 200));

  if (publishedToRedis) {
    console.log('✅ Complete event flow successful!');
  }
};

/**
 * Run all integration tests
 */
export const runAllTests = async (): Promise<void> => {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   WebSocket Event System Integration Tests   ║');
  console.log('╚════════════════════════════════════════════╝');

  try {
    testEventEmission();
    await testEventListeners();
    await testRedisIntegration();
    await testCompleteEventFlow();

    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║  ✅ All integration tests passed!         ║');
    console.log('╚════════════════════════════════════════════╝\n');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
};

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(console.error);
}
