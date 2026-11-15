import { describe, expect, it } from 'vitest';
import { linkTarget } from './linkTarget';

describe('linkTarget', () => {
  it.each([
    'https://claude.ai/chat/1',
    'http://example.com/a?b=c',
    '  https://example.com  ',
    'HTTPS://EXAMPLE.COM',
  ])('opens %s in the app', (url) => {
    expect(linkTarget(url)).toBe('in-app');
  });

  it.each([
    'mailto:a@b.co',
    'tel:+5400000',
    'sms:+5400000',
    'openagentspocket://agent/h/p',
    'agentico://usage',
    'slack://open',
  ])('hands %s to the system', (url) => {
    expect(linkTarget(url)).toBe('system');
  });

  it.each([
    '',
    '   ',
    'example.com',
    'not a url',
    'https://',
    'http:///path',
    'javascript:alert(1)',
    ' JavaScript:alert(1)',
    'data:text/html,hi',
    'file:///etc/passwd',
    'vbscript:x',
  ])('refuses %j', (url) => {
    expect(linkTarget(url)).toBe('refuse');
  });
});
