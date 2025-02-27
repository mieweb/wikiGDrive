import fs from 'node:fs';
import path from 'node:path';
// eslint-disable-next-line import/no-unresolved
import {assertStrictEquals} from 'asserts';

import {
  generateNavigationHierarchy,
  NavigationHierarchy,
  NavigationHierarchyNode
} from '../../src/containers/transform/generateNavigationHierarchy.ts';
import {UnMarshaller} from '../../src/odt/UnMarshaller.ts';
import {DocumentContent, LIBREOFFICE_CLASSES} from '../../src/odt/LibreOffice.ts';
import {compareObjects} from '../utils.ts';


const __dirname = import.meta.dirname;

const NODES: NavigationHierarchyNode[] = [
  {
    identifier: '1TbYl56bYzCZsXjAtsF3wMay92vryJzpt7YrLOm22oyk',
    name: 'Programs',
    weight: 30
  },
  {
    identifier: '1qfdYxyVgYVpx-5CSpa9MgE22iijISUGMA-5Kg4Zd9jU',
    name: 'Medical Programs',
    weight: 40,
    parent: '1TbYl56bYzCZsXjAtsF3wMay92vryJzpt7YrLOm22oyk',
  },
  {
    identifier: '1VhdbTx-CN21VofK5OI8hM7_t8ZE931BH-CjqQsi0-B0',
    name: 'Occupational Medicine',
    weight: 50,
    parent: '1qfdYxyVgYVpx-5CSpa9MgE22iijISUGMA-5Kg4Zd9jU',
  },
  {
    identifier: '1o9yP0CDEwr8G6Fgr5xRbbJe2TWKl4JavucDvzvIGU_c',
    name: 'Medical Clearance',
    weight: 60,
    parent: '1VhdbTx-CN21VofK5OI8hM7_t8ZE931BH-CjqQsi0-B0',
  },
  {
    identifier: '1ZazV-O1C7sT_Alm_cVaPWxbLBLpUz9wBXsR_-P3_uEs',
    name: 'Surveillance Procedures',
    weight: 70,
    parent: '1VhdbTx-CN21VofK5OI8hM7_t8ZE931BH-CjqQsi0-B0',
  },
  {
    identifier: '1D2Tr1fpF7oqAx0hsXkwT5D2RA1epjcGuNFVNv87bXEM',
    name: 'Clinical Medicine',
    weight: 80,
    parent: '1qfdYxyVgYVpx-5CSpa9MgE22iijISUGMA-5Kg4Zd9jU',
  },
  {
    identifier: '1D-Ah67z4hSAKLf0PITZr19h2pvlg3rVBva6P3yl1bno',
    name: 'Compliance Programs',
    weight: 90,
    parent: '1TbYl56bYzCZsXjAtsF3wMay92vryJzpt7YrLOm22oyk',
  },
  {
    identifier: '11c7LYNpC6JP7pLJuiK9RWaFFr6CN20w9S0z9t5hvN8o',
    name: 'Worksite Injury & Illness',
    weight: 100,
    parent: '1D-Ah67z4hSAKLf0PITZr19h2pvlg3rVBva6P3yl1bno',
  }
];

const NAV2 = {
  header_1: { identifier: 'header_1', name: 'General knowledge', weight: 30 },
  '1nDQY-ycDqNegxhv58znr_gUP3i_BOkxgLpadAfjDbA4': {
    identifier: '1nDQY-ycDqNegxhv58znr_gUP3i_BOkxgLpadAfjDbA4',
    name: 'MIE Utilities - Format Specifiers',
    weight: 40,
    parent: 'header_1'
  },
  '1yheEcYMFENfZQgK56y5irceFdouZAiyib2wv2hebBcg': {
    identifier: '1yheEcYMFENfZQgK56y5irceFdouZAiyib2wv2hebBcg',
    name: 'MIEstache Layout Development',
    weight: 50,
    parent: 'header_1'
  },
  '17bn5HODqUh7Jbu-kvseS6hLXbuySmaBw6AIBJ75NMLE': {
    identifier: '17bn5HODqUh7Jbu-kvseS6hLXbuySmaBw6AIBJ75NMLE',
    name: 'JSON API',
    weight: 60,
    parent: 'header_1'
  },
  '1hRYsvhM60k83riEJEyjZLYNeemZPQVDJtb7Z08NzJJM': {
    identifier: '1hRYsvhM60k83riEJEyjZLYNeemZPQVDJtb7Z08NzJJM',
    name: 'ObjectWin',
    weight: 70,
    parent: 'header_1'
  },
  '146m1bQAGmicAxw4smDCYt0jpxmF1fu62-ZR5yOG76ko': {
    identifier: '146m1bQAGmicAxw4smDCYt0jpxmF1fu62-ZR5yOG76ko',
    name: 'Scriptlets',
    weight: 80,
    parent: 'header_1'
  },
  '1YFvYcHy6UuzClvfz9Q46pPISmdZyvSgML0qoaSbauQs': {
    identifier: '1YFvYcHy6UuzClvfz9Q46pPISmdZyvSgML0qoaSbauQs',
    name: 'WebcChart Table Revisions',
    weight: 100,
    parent: 'header_1'
  },
  header_2: { identifier: 'header_2', name: 'Training', weight: 110 },
  '1YzsOG2fuzvm71LWe7jZDNszw8QuHHvaVD4LMnzk5qsk': {
    identifier: '1YzsOG2fuzvm71LWe7jZDNszw8QuHHvaVD4LMnzk5qsk',
    name: 'New Developer Plan',
    weight: 120,
    parent: 'header_2'
  },
  header_3: {
    identifier: 'header_3',
    name: 'Non-WebChart applications',
    weight: 130
  },
  '1-mhQYhDKcH5fCEduAMfwNhrb-IUb1Hh67Fkk5jlnfHQ': {
    identifier: '1-mhQYhDKcH5fCEduAMfwNhrb-IUb1Hh67Fkk5jlnfHQ',
    name: 'MIE E-Token App',
    weight: 140,
    parent: 'header_3'
  },
  '1fBUTUqttqaIyZsVOcFx1q9kiOqpaYQpmhj1rVmp2SiE': {
    identifier: '1fBUTUqttqaIyZsVOcFx1q9kiOqpaYQpmhj1rVmp2SiE',
    name: 'MIE SSL App',
    weight: 150,
    parent: 'header_3'
  },
  header_4: { identifier: 'header_4', name: 'Niche topics', weight: 160 },
  '1o6sfAdO_L1DoTFmn5F9zA-Dhmix3Thzll52pUqnKZXw': {
    identifier: '1o6sfAdO_L1DoTFmn5F9zA-Dhmix3Thzll52pUqnKZXw',
    name: 'Alternatiff Bubble Scanning Code',
    weight: 170,
    parent: 'header_4'
  },
  '1fUXsJKfZIIW0KdoWpfN0dDn1VQSLvNuVjlNhbJ588Ek': {
    identifier: '1fUXsJKfZIIW0KdoWpfN0dDn1VQSLvNuVjlNhbJ588Ek',
    name: 'Bubble Forms Technical Reference',
    weight: 180,
    parent: 'header_4'
  },
  '1Bx9oP3ip2GLqLJSkH-6gFkr3JX_zSAIfabPpWr2hWUc': {
    identifier: '1Bx9oP3ip2GLqLJSkH-6gFkr3JX_zSAIfabPpWr2hWUc',
    name: 'Encdynamic Profiling',
    weight: 190,
    parent: 'header_4'
  },
  '10wvGT70wZYxCKmSQv-ge6Gho5zMSCEQP0C7dD4QYg9Q': {
    identifier: '10wvGT70wZYxCKmSQv-ge6Gho5zMSCEQP0C7dD4QYg9Q',
    name: 'How to make a github deploy key',
    weight: 200,
    parent: 'header_4'
  },
  '1P8ehs5hne9Xn1AgnuyopqM4T70QW6cmdYIDogAa5ZVw': {
    identifier: '1P8ehs5hne9Xn1AgnuyopqM4T70QW6cmdYIDogAa5ZVw',
    name: 'Scripted Rules Reference',
    weight: 210,
    parent: 'header_4'
  },
  '1uXtzI-EzlDS485kQlkeOgnurzrRm4DXGYtyHyiVCewk': {
    identifier: '1uXtzI-EzlDS485kQlkeOgnurzrRm4DXGYtyHyiVCewk',
    name: 'Scope-limited CSS and Javascript',
    weight: 220,
    parent: 'header_4'
  }
};

Deno.test('test ./nav.xml', async () => {
  const content = fs.readFileSync(path.join(__dirname, 'nav.xml'));
  const parser = new UnMarshaller(LIBREOFFICE_CLASSES, 'DocumentContent');
  const navDoc: DocumentContent = parser.unmarshal(content);

  const expected: NavigationHierarchy = {};
  for (const node of NODES) {
    expected[node.identifier] = node;
  }

  const actual = await generateNavigationHierarchy(navDoc, { warn: (msg) => console.warn(msg)});
  assertStrictEquals(true, compareObjects(actual, expected));
});

Deno.test('test ./nav2.xml', async () => {
  const content = fs.readFileSync(path.join(__dirname, 'nav2.xml'));
  const parser = new UnMarshaller(LIBREOFFICE_CLASSES, 'DocumentContent');
  const navDoc: DocumentContent = parser.unmarshal(content);

  const expected: NavigationHierarchy = {};
  for (const node of NODES) {
    expected[node.identifier] = node;
  }

  const actual = await generateNavigationHierarchy(navDoc, { warn: (msg) => console.warn(msg)});
  assertStrictEquals(true, compareObjects(actual, NAV2));
});
