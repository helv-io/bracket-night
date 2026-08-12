import assert from 'assert'
import { sanitizeTopic, assertSafeImageUrl, MAX_TOPIC_LENGTH, _test } from './security'

const { isPrivateIp, isAllowedHostname } = _test

async function run() {
  // Topic sanitization
  assert.strictEqual(sanitizeTopic(''), null)
  assert.strictEqual(sanitizeTopic('   '), null)
  assert.strictEqual(sanitizeTopic('a'.repeat(MAX_TOPIC_LENGTH + 1)), null)
  assert.strictEqual(sanitizeTopic('  Pizza Toppings  '), 'Pizza Toppings')
  assert.strictEqual(sanitizeTopic('bad\u0000topic'), 'badtopic')

  // Private IP detection
  assert.strictEqual(isPrivateIp('127.0.0.1'), true)
  assert.strictEqual(isPrivateIp('10.0.0.5'), true)
  assert.strictEqual(isPrivateIp('192.168.1.1'), true)
  assert.strictEqual(isPrivateIp('169.254.169.254'), true)
  assert.strictEqual(isPrivateIp('172.16.0.1'), true)
  assert.strictEqual(isPrivateIp('8.8.8.8'), false)
  assert.strictEqual(isPrivateIp('::1'), true)
  assert.strictEqual(isPrivateIp('2001:4860:4860::8888'), false)

  // Hostname allowlist / blocklist
  assert.strictEqual(isAllowedHostname('localhost'), false)
  assert.strictEqual(isAllowedHostname('metadata.google.internal'), false)
  assert.strictEqual(isAllowedHostname('127.0.0.1'), false)
  assert.strictEqual(isAllowedHostname('example.com'), true)

  // Scheme / credential rejection
  await assert.rejects(() => assertSafeImageUrl('file:///etc/passwd'), /http/)
  await assert.rejects(() => assertSafeImageUrl('http://127.0.0.1/x'), /not allowed|private/)
  await assert.rejects(() => assertSafeImageUrl('http://user:pass@example.com/x'), /credentials/)
  await assert.rejects(() => assertSafeImageUrl('http://169.254.169.254/latest/meta-data/'), /not allowed|private/)

  console.log('security.test.ts: all assertions passed')
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
