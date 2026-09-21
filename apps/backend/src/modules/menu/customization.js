/**
 * Customization validation + price-delta helper — shared by
 * orders.service.js (actual charge) and cart.service.js (preview + add-item).
 *
 * Validates the client-supplied `selectedOptions` shape against the menu
 * item's CustomizationGroup + CustomizationOption rows:
 *   - Every (groupId, optionId) pair must reference a real option that
 *     belongs to a real group on this menu item.
 *   - Each group's minSelect / maxSelect constraints are enforced.
 *   - Duplicate selections within a group are rejected.
 *
 * Returns the total priceDelta for use in computing the item's total.
 *
 * Spec ref: §4 entities #9 + #10 (customization model) + §13 (cart
 * validation rules).
 */

/**
 * @param {Object} menuItem — must include `customizationGroups: { include: { options: true } }`
 *   (use menuRepo.findById, which already does this include).
 * @param {Array<{groupId: string, optionId: string}>} selectedOptions
 * @returns {number} total priceDelta (sum of selected options' priceDelta)
 * @throws {{statusCode: 400, message: string}} on any validation failure
 */
function validateAndComputeOptionsDelta(menuItem, selectedOptions) {
  const groups = menuItem.customizationGroups || [];

  // Build lookups: groupId → group, optionId → { option, groupId }
  const groupMap = new Map();
  const optionMap = new Map();
  for (const g of groups) {
    groupMap.set(g.id, g);
    for (const o of (g.options || [])) {
      optionMap.set(o.id, { option: o, groupId: g.id });
    }
  }

  // Track selections per group for min/max + duplicate detection.
  const selectionsByGroup = new Map();

  if (selectedOptions && selectedOptions.length > 0) {
    for (const sel of selectedOptions) {
      if (!sel || !sel.groupId || !sel.optionId) {
        throw { statusCode: 400, message: 'Each selectedOption must have groupId and optionId' };
      }

      const lookup = optionMap.get(sel.optionId);
      if (!lookup) {
        throw {
          statusCode: 400,
          message: `Customization option ${sel.optionId} does not exist on menu item "${menuItem.name}"`,
        };
      }
      if (lookup.groupId !== sel.groupId) {
        throw {
          statusCode: 400,
          message: `Customization option ${sel.optionId} does not belong to group ${sel.groupId}`,
        };
      }

      const sels = selectionsByGroup.get(sel.groupId) || [];
      if (sels.includes(sel.optionId)) {
        throw {
          statusCode: 400,
          message: `Duplicate customization option ${sel.optionId} in group ${sel.groupId}`,
        };
      }
      sels.push(sel.optionId);
      selectionsByGroup.set(sel.groupId, sels);
    }
  }

  // Enforce minSelect / maxSelect for every group on the menu item.
  for (const [groupId, group] of groupMap.entries()) {
    const sels = selectionsByGroup.get(groupId) || [];
    const minSelect = group.minSelect ?? 0;
    const maxSelect = group.maxSelect ?? 1;
    if (sels.length < minSelect) {
      throw {
        statusCode: 400,
        message: `Customization group "${group.name}" requires at least ${minSelect} selection(s); got ${sels.length}`,
      };
    }
    if (maxSelect !== null && sels.length > maxSelect) {
      throw {
        statusCode: 400,
        message: `Customization group "${group.name}" allows at most ${maxSelect} selection(s); got ${sels.length}`,
      };
    }
  }

  // Sum the priceDelta for the selected options.
  let priceDelta = 0;
  for (const sels of selectionsByGroup.values()) {
    for (const optionId of sels) {
      const { option } = optionMap.get(optionId);
      priceDelta += Number(option.priceDelta || 0);
    }
  }
  return priceDelta;
}

module.exports = { validateAndComputeOptionsDelta };
