import test from 'node:test';
import assert from 'node:assert/strict';
import {boothFootprint} from '../src/lib/boothFootprint.ts';
import {boothEditPricing} from '../src/lib/boothEditPricing.ts';

test('unrelated legacy edits preserve the authoritative total without multiplying it by area',()=>{
  const booth={price:1000,size_sqm:10,additional_costs:0};
  assert.equal(boothEditPricing(booth,'10','100','0').total,1000);
  const fractional={price:1000,size_sqm:12,additional_costs:7};
  const rate=boothEditPricing(fractional,'','','').originalRate;
  assert.equal(boothEditPricing(fractional,'12',String(rate),'7').total,1000);
  assert.equal(boothEditPricing(booth,'12','100','5').total,1205);
});

test('standard footprint accepts rotated minima and larger rectangles with exact area',()=>{
  for(const [width,depth,area] of [['3','4','12.00'],['4','3','12.00'],['4','5','20.00'],['3.01','4.01','12.07']]){
    const result=boothFootprint(width,depth);assert.equal(result.compliant,true);assert.equal(result.area,area);
  }
});
test('area alone never makes a narrow or incomplete booth compliant',()=>{
  for(const pair of [['2','6'],['3','3'],['2.5','5'],['','4'],['3.001','4'],['-3','4'],['0','4']])assert.equal(boothFootprint(...pair).compliant,false);
});
