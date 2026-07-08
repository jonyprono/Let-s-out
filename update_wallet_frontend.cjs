const fs = require('fs');
let content = fs.readFileSync('c:/Users/carlo/Desktop/Lets out/apps/web/src/app/components/Wallet.tsx', 'utf8');

// Add imports
content = content.replace(
  `import { ChevronLeft } from 'lucide-react'`,
  `import { ChevronLeft } from 'lucide-react'\nimport { WalletPinManager } from './WalletPinManager'`
);

// Add pinToken state
content = content.replace(
  `const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false)`,
  `const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false)\n  const [pinToken, setPinToken] = useState<string | null>(null)`
);

// Update wallet query
content = content.replace(
  `queryKey: ['wallet'],`,
  `queryKey: ['wallet', pinToken],`
);
content = content.replace(
  `const res = await apiClient.get<{ data: WalletData }>('/wallet')`,
  `if (!pinToken) return null\n      const res = await apiClient.get<{ data: WalletData }>('/wallet', { headers: { 'x-wallet-pin-token': pinToken } })`
);
content = content.replace(
  `return res.data.data\n    },`,
  `return res.data.data\n    },\n    enabled: !!pinToken,`
);

// Update transactions query
content = content.replace(
  `queryKey: ['wallet-transactions'],`,
  `queryKey: ['wallet-transactions', pinToken],`
);
content = content.replace(
  `const res = await apiClient.get<{ data: WalletTransaction[] }>('/wallet/transactions')`,
  `if (!pinToken) return null\n      const res = await apiClient.get<{ data: WalletTransaction[] }>('/wallet/transactions', { headers: { 'x-wallet-pin-token': pinToken } })`
);
content = content.replace(
  `return res.data.data\n    },`,
  `return res.data.data\n    },\n    enabled: !!pinToken,`
);

// Update withdraw mutation
content = content.replace(
  `const res = await apiClient.post('/wallet/payout', payload)`,
  `const res = await apiClient.post('/wallet/payout', payload, { headers: { 'x-wallet-pin-token': pinToken } })`
);

// Wrap return with if (!pinToken)
content = content.replace(
  `return (\n    <div className={\`bg-[#F9FAFB]`,
  `if (!pinToken) {\n    return <WalletPinManager onVerified={setPinToken} />\n  }\n\n  return (\n    <div className={\`bg-[#F9FAFB]`
);

fs.writeFileSync('c:/Users/carlo/Desktop/Lets out/apps/web/src/app/components/Wallet.tsx', content);
