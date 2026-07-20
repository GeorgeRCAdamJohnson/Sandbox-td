// shop.js - Weapon shop between rounds
import { WEAPONS } from './constants.js';
import { state, GamePhase } from './state.js';

let shopPlayerIndex = 0;
let shopDone = false;

export function openShop() {
  state.phase = GamePhase.SHOP;
  shopPlayerIndex = 0;
  shopDone = false;
  // Skip AI players, they auto-buy
  skipAIPlayers();
  renderShopUI();
}

function skipAIPlayers() {
  while (shopPlayerIndex < state.players.length) {
    const player = state.players[shopPlayerIndex];
    if (!player.alive) {
      shopPlayerIndex++;
      continue;
    }
    if (player.isAI) {
      aiBuyWeapons(player);
      shopPlayerIndex++;
      continue;
    }
    break;
  }
  if (shopPlayerIndex >= state.players.length) {
    shopDone = true;
  }
}

function aiBuyWeapons(player) {
  // AI buys random weapons with its money
  const budget = player.money * 0.7;
  let spent = 0;
  const shuffled = [...WEAPONS].filter(w => w.cost > 0).sort(() => Math.random() - 0.5);

  for (const weapon of shuffled) {
    if (spent + weapon.cost <= budget && weapon.cost <= player.money - spent) {
      player.weapons[weapon.id].owned += 1;
      spent += weapon.cost;
    }
  }
  player.money -= spent;
}

export function buyWeapon(weaponId) {
  const player = state.players[shopPlayerIndex];
  if (!player) return false;

  const weapon = WEAPONS[weaponId];
  if (!weapon || weapon.cost === 0) return false;
  if (player.money < weapon.cost) return false;

  player.money -= weapon.cost;
  player.weapons[weaponId].owned += 1;
  renderShopUI();
  return true;
}

export function sellWeapon(weaponId) {
  const player = state.players[shopPlayerIndex];
  if (!player) return false;

  const weapon = WEAPONS[weaponId];
  if (!weapon || weapon.cost === 0) return false;
  if (player.weapons[weaponId].owned <= 0) return false;

  player.weapons[weaponId].owned -= 1;
  player.money += Math.floor(weapon.cost * 0.5);
  renderShopUI();
  return true;
}

export function finishShopping() {
  shopPlayerIndex++;
  skipAIPlayers();
  if (shopDone) {
    return true; // All done
  }
  renderShopUI();
  return false;
}

export function getShopPlayer() {
  if (shopPlayerIndex < state.players.length) {
    return state.players[shopPlayerIndex];
  }
  return null;
}

export function isShopDone() {
  return shopDone;
}

function renderShopUI() {
  const overlay = document.getElementById('shop-overlay');
  if (!overlay) return;

  const player = state.players[shopPlayerIndex];
  if (!player) {
    overlay.style.display = 'none';
    return;
  }

  overlay.style.display = 'flex';
  const content = overlay.querySelector('.shop-content');
  if (!content) return;

  let html = `<h2 style="color:${player.color}">🛒 ${player.name}'s Weapon Shop</h2>`;
  html += `<p class="shop-money">Cash: $${player.money.toLocaleString()}</p>`;
  html += '<div class="shop-grid">';

  for (let i = 1; i < WEAPONS.length; i++) {
    const w = WEAPONS[i];
    const owned = player.weapons[i].owned;
    const canBuy = player.money >= w.cost;
    const canSell = owned > 0;

    html += `<div class="shop-item">
      <span class="shop-name">${w.name}</span>
      <span class="shop-cost">$${w.cost.toLocaleString()}</span>
      <span class="shop-owned">Owned: ${owned}</span>
      <div class="shop-buttons">
        <button onclick="window.shopBuy(${i})" ${canBuy ? '' : 'disabled'}>Buy</button>
        <button onclick="window.shopSell(${i})" ${canSell ? '' : 'disabled'}>Sell</button>
      </div>
    </div>`;
  }

  html += '</div>';
  html += '<button class="shop-done-btn" onclick="window.shopDone()">Done Shopping</button>';

  content.innerHTML = html;
}
