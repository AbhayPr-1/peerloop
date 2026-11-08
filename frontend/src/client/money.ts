const WEI_PER_ETH = 10n ** 18n;

function ethToWei(value: string | number): bigint {
  const amount = String(value).trim();
  const match = /^(0|[1-9]\d*)(?:\.(\d{0,18}))?$/.exec(amount);
  if (!match) throw new Error('ETH amount must be a non-negative decimal with at most 18 places.');
  const fraction = (match[2] || '').padEnd(18, '0');
  return BigInt(match[1]) * WEI_PER_ETH + BigInt(fraction || '0');
}

function weiToEth(wei: bigint, decimals = 18): string {
  if (typeof wei !== 'bigint' || wei < 0n) throw new Error('Wei amount must be a non-negative integer.');
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 18) {
    throw new Error('ETH display precision must be between 0 and 18 decimal places.');
  }
  const unit = 10n ** BigInt(18 - decimals);
  const rounded = ((wei + unit / 2n) / unit) * unit;
  const whole = rounded / WEI_PER_ETH;
  if (decimals === 0) return whole.toString();
  const fraction = (rounded % WEI_PER_ETH).toString().padStart(18, '0').slice(0, decimals);
  const trimmedFraction = fraction.replace(/0+$/, '');
  return trimmedFraction ? `${whole}.${trimmedFraction}` : whole.toString();
}

window.PeerLoopMoney = Object.freeze({
  toWei: ethToWei,
  fromWei: weiToEth,
  formatEth: (value: string | number, decimals = 18) => weiToEth(ethToWei(value), decimals),
  sumEth: (values: Array<string | number>) => values.reduce((total, value) => total + ethToWei(value), 0n),
  compareEth: (left: string | number, right: string | number) => {
    const leftWei = ethToWei(left);
    const rightWei = ethToWei(right);
    return leftWei < rightWei ? -1 : leftWei > rightWei ? 1 : 0;
  }
});
