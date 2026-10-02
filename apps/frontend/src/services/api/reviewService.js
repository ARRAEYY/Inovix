import client from './client';
import { cacheGet, cacheSet, cacheClearPrefix } from '../cache/localCache';

// Food-wise reviews are re-fetched every time a menu page opens a reviews
// sheet — cache each item's list in localStorage (stale-while-revalidate)
// so repeat views paint instantly from `cached` and refresh via `fetch`.

const FOOD_REVIEWS_MAX_AGE_MS = 5 * 60 * 1000;

export const reviewService = {
  getForFood: (menuItemId) => {
    const key = `food-reviews:${menuItemId}`;
    return {
      cached: cacheGet(key, FOOD_REVIEWS_MAX_AGE_MS),
      fetch: async () => {
        const res = await client.get(`/reviews/food/${menuItemId}`);
        const list = res.data?.data || [];
        cacheSet(key, list);
        return list;
      },
    };
  },
  // Called after submitting reviews — cached per-item lists are now stale.
  invalidateAll: () => cacheClearPrefix('food-reviews:'),
};
