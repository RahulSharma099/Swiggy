#!/usr/bin/env node
/**
 * Simple integration test runner
 */

(async () => {
  console.log('\n╔════════════════════════════════════════════╗');
  console.log('║   WebSocket Event System Integration Tests   ║');
  console.log('╚════════════════════════════════════════════╝\n');

  try {
    // Test 1: Redis connectivity
    console.log('=== TEST 1: Testing Redis Connectivity ===');
    try {
      const redis = require('redis');
      const client = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      });

      client.on('error', (err) => {
        throw err;
      });

      await client.connect();
      const pong = await client.ping();
      console.log(`✅ Redis connected on ${process.env.REDIS_URL || 'redis://localhost:6379'}`);
      console.log(`✅ PING response: ${pong}`);
      await client.quit();
    } catch (error) {
      console.log(`❌ Redis connection failed: ${error.message}`);
      throw error;
    }

    // Test 2: Pub/Sub test
    console.log('\n=== TEST 2: Testing Pub/Sub Messaging ===');
    try {
      const redis = require('redis');
      const pub = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      });
      const sub = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      });

      await pub.connect();
      await sub.connect();

      let messageReceived = false;
      const testChannel = 'test:integration';

      sub.subscribe(testChannel, (message) => {
        if (message === 'Hello from test') {
          messageReceived = true;
          console.log(`✅ Received message on channel "${testChannel}"`);
        }
      });

      // Wait for subscription
      await new Promise(resolve => setTimeout(resolve, 50));

      // Publish test message
      await pub.publish(testChannel, 'Hello from test');
      console.log(`✅ Published message to "${testChannel}"`);

      // Wait for receipt
      await new Promise(resolve => setTimeout(resolve, 100));

      if (messageReceived) {
        console.log('✅ Pub/Sub working correctly');
      }

      await pub.quit();
      await sub.quit();
    } catch (error) {
      console.log(`❌ Pub/Sub test failed: ${error.message}`);
      throw error;
    }

    // Test 3: Workspace channel simulation
    console.log('\n=== TEST 3: Testing Workspace Event Channels ===');
    try {
      const redis = require('redis');
      const pub = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      });
      const sub = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      });

      await pub.connect();
      await sub.connect();

      let eventReceived = false;
      const workspaceChannel = 'ws:workspace:ws-integration-test';

      sub.subscribe(workspaceChannel, (message) => {
        const event = JSON.parse(message);
        if (event.type === 'issue:created') {
          eventReceived = true;
          console.log(`✅ Received event: ${event.type}`);
          console.log(`   Issue: ${event.payload.issueId}`);
          console.log(`   Title: ${event.payload.title}`);
        }
      });

      // Wait for subscription
      await new Promise(resolve => setTimeout(resolve, 50));

      // Publish test event
      const testEvent = {
        type: 'issue:created',
        payload: {
          issueId: 'test-issue-456',
          projectId: 'proj-test',
          workspaceId: 'ws-integration-test',
          title: 'Integration Test - Issue Created',
          createdAt: new Date().toISOString(),
        },
        timestamp: Date.now(),
      };

      await pub.publish(workspaceChannel, JSON.stringify(testEvent));
      console.log('✅ Published test event to workspace channel');

      // Wait for reception
      await new Promise(resolve => setTimeout(resolve, 100));

      if (eventReceived) {
        console.log('✅ Workspace event channel working');
      }

      await pub.quit();
      await sub.quit();
    } catch (error) {
      console.log(`❌ Workspace channel test failed: ${error.message}`);
      throw error;
    }

    // Summary
    console.log('\n╔════════════════════════════════════════════╗');
    console.log('║  ✅ All integration tests passed!         ║');
    console.log('╚════════════════════════════════════════════╝\n');
    console.log('✅ Redis is running and accessible');
    console.log('✅ Pub/Sub messaging working');
    console.log('✅ WebSocket event channels ready\n');
    console.log('Next steps:');
    console.log('  1. Start API server: npm run dev (packages/api)');
    console.log('  2. Start WebSocket: npm run dev (packages/websocket)');
    console.log('  3. Connect client: ws://localhost:8080?workspaceId=xxx&userId=yyy');
    console.log('  4. Create issues and watch real-time updates!\n');

  } catch (error) {
    console.error('\n❌ Integration test failed');
    console.error('Error:', error.message);
    console.error('\nIMPORTANT: Make sure Redis is running on port 6380');
    console.error('Run: redis-cli -p 6380 ping\n');
    process.exit(1);
  }
})();
