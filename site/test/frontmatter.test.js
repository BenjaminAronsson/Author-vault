import { describe, it, expect } from 'vitest';
import { setField, addListItem, setRaw, removeField } from '../src/lib/frontmatter.js';

const note = `---
type: character
image: ""            # comment
portraits: []        # [{at: B1-C14, file: "[[x.webp]]"}]
gallery: []
tags: [character]
---
# Mara
`;

describe('frontmatter edits', () => {
  it('replaces image and keeps the rest', () => {
    const out = setField(note, 'image', '[[mara.webp]]');
    expect(out).toContain('image: "[[mara.webp]]"');
    expect(out).toContain('tags: [character]');
    expect(out.endsWith('# Mara\n')).toBe(true);
  });
  it('adds image when missing', () => {
    const out = setField('---\ntype: place\n---\nbody', 'image', '[[a.webp]]');
    expect(out).toBe('---\ntype: place\nimage: "[[a.webp]]"\n---\nbody');
  });
  it('turns an empty flow list into a block list', () => {
    const out = addListItem(note, 'portraits', '{at: B1-C05, file: "[[ash.webp]]"}');
    expect(out).toContain('portraits:\n  - {at: B1-C05, file: "[[ash.webp]]"}\ngallery: []');
  });
  it('keeps existing flow items and appends', () => {
    const src = '---\nportraits: [{at: B1-C02, file: "[[a.webp]]"}]\n---\n';
    const out = addListItem(src, 'portraits', '{at: B1-C05, file: "[[b.webp]]"}');
    expect(out).toBe('---\nportraits:\n  - {at: B1-C02, file: "[[a.webp]]"}\n  - {at: B1-C05, file: "[[b.webp]]"}\n---\n');
  });
  it('appends to an existing block list', () => {
    const src = '---\nportraits:\n  - {at: B1-C02, file: "[[a.webp]]"}\ntags: []\n---\n';
    expect(addListItem(src, 'portraits', '{at: B1-C09, file: "[[c.webp]]"}')).toBe('---\nportraits:\n  - {at: B1-C02, file: "[[a.webp]]"}\n  - {at: B1-C09, file: "[[c.webp]]"}\ntags: []\n---\n');
  });
  it('sets a raw flow map and removes fields', () => {
    const src = '---\ntype: location\nmap: {x: 0.1, y: 0.2}\ntags: []\n---\n';
    expect(setRaw(src, 'map', '{x: 0.500, y: 0.250}')).toBe('---\ntype: location\nmap: {x: 0.500, y: 0.250}\ntags: []\n---\n');
    expect(removeField(src, 'map')).toBe('---\ntype: location\ntags: []\n---\n');
    expect(removeField(src, 'nope')).toBe(src);
  });
});
