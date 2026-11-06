import { describe, it, expect } from 'vitest';
import { NetClient } from '../src/net/client';
import type { Profile } from '../src/shared/profile';

const mk = () => new NetClient('ws://127.0.0.1:1/ws', 'tok', () => ({ name: 'x' } as Profile));

describe('NetClient.chain：多个面板共用一个服务器回调', () => {
  it('先后注册都会收到，后注册的不会把前面的顶掉（合成台/背包/彩票都靠 inv）', () => {
    const net = mk();
    const got: string[] = [];
    net.chain('inv', (items) => got.push(`背包:${items.bait ?? 0}`));
    net.chain('inv', (items) => got.push(`合成台:${items.bait ?? 0}`));
    net.chain('inv', (items, gain) => got.push(`彩票:${items.lottery ?? 0}/${gain?.length ?? 0}`));
    net.handlers.inv?.({ bait: 3, lottery: 2 }, [{ id: 'bait', n: 1 }]);
    expect(got).toEqual(['背包:3', '合成台:3', '彩票:2/1']);
  });

  it('同一个回调注册多次按顺序执行；没有前一个也能用', () => {
    const net = mk();
    const order: number[] = [];
    net.chain('coins', (n) => order.push(n));
    net.handlers.coins?.(7);
    expect(order).toEqual([7]);
    net.chain('coins', (n) => order.push(n * 2));
    net.handlers.coins?.(5);
    expect(order).toEqual([7, 5, 10]);
  });
});
