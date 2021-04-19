import {assert} from 'chai';
import * as fs from 'fs';

import {
  generateNavigationHierarchy,
  NavigationHierarchy,
  NavigationHierarchyNode
} from '../../src/generateNavigationHierarchy';
import {LocalFile} from '../../src/storage/LocalFilesStorage';

const NODES: NavigationHierarchyNode[] = [
  {
    identifier: '1',
    name: 'Programs',
    weight: 30
  },
  {
    identifier: '2',
    name: 'Medical Programs',
    weight: 40,
    parent: '1',
  },
  {
    identifier: '3',
    name: 'Occupational Medicine',
    weight: 50,
    parent: '2',
  },
  {
    identifier: '4',
    name: 'Medical Clearance',
    weight: 60,
    parent: '3',
  },
  {
    identifier: '5',
    name: 'Surveillance Procedures',
    weight: 70,
    parent: '3',
  },
  {
    identifier: '6',
    name: 'Clinical Medicine',
    weight: 80,
    parent: '2',
  },
  {
    identifier: '7',
    name: 'Compliance Programs',
    weight: 90,
    parent: '1',
  },
  {
    identifier: '8',
    name: 'Worksite Injury & Illness',
    weight: 100,
    parent: '7',
  }
];

const FILES: LocalFile[] = [
  {
    id: '1',
    name: 'Programs',
    desiredLocalPath: 'https://drive.google.com/open?id=1TbYl56bYzCZsXjAtsF3wMay92vryJzpt7YrLOm22oyk'
  },
  {
    id: '2',
    name: 'Medical Programs',
    desiredLocalPath: 'https://drive.google.com/open?id=1qfdYxyVgYVpx-5CSpa9MgE22iijISUGMA-5Kg4Zd9jU'
  },
  {
    id: '3',
    name: 'Occupational Medicine',
    desiredLocalPath: 'https://drive.google.com/open?id=1VhdbTx-CN21VofK5OI8hM7_t8ZE931BH-CjqQsi0-B0'
  },
  {
    id: '4',
    name: 'Medical Clearance',
    desiredLocalPath: 'https://drive.google.com/open?id=1o9yP0CDEwr8G6Fgr5xRbbJe2TWKl4JavucDvzvIGU_c'
  },
  {
    id: '5',
    name: 'Surveillance Procedures',
    desiredLocalPath: 'https://drive.google.com/open?id=1ZazV-O1C7sT_Alm_cVaPWxbLBLpUz9wBXsR_-P3_uEs'
  },
  {
    id: '6',
    name: 'Clinical Medicine',
    desiredLocalPath: 'https://drive.google.com/open?id=1D2Tr1fpF7oqAx0hsXkwT5D2RA1epjcGuNFVNv87bXEM'
  },
  {
    id: '7',
    name: 'Compliance Programs',
    desiredLocalPath: 'https://drive.google.com/open?id=1D-Ah67z4hSAKLf0PITZr19h2pvlg3rVBva6P3yl1bno'
  },
  {
    id: '8',
    name: 'Worksite Injury & Illness',
    desiredLocalPath: 'https://drive.google.com/open?id=11c7LYNpC6JP7pLJuiK9RWaFFr6CN20w9S0z9t5hvN8o'
  },
]

describe('NavigationExtractTest', () => {

  it('test ./nav.json', async () => {
    const doc = JSON.parse(fs.readFileSync(__dirname + '/nav.json').toString());
    const expected: NavigationHierarchy = {};
    for (const node of NODES) {
      expected[node.identifier] = node;
    }

    const actual = await generateNavigationHierarchy(doc, FILES, { warn: (msg) => console.warn(msg)});
    assert.deepEqual(actual, expected);

    return Promise.resolve();
  });

});
