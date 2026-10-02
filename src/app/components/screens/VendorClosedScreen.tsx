import { motion } from 'motion/react';
import { Store } from 'lucide-react';
import { useVendor } from '@/app/context/VendorContext';

interface VendorClosedScreenProps {
  onSwitchVendor: () => void;
  onViewOrders?: () => void;
}

export function VendorClosedScreen({ onSwitchVendor, onViewOrders }: VendorClosedScreenProps) {
  const { selectedVendor } = useVendor();
  const name = selectedVendor?.business_name ?? 'This vendor';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-[100dvh] bg-[#fefaf4] flex items-center justify-center px-4 py-6 [webkit-tap-highlight-color:transparent]"
    >
      <div className="max-w-md w-full pb-[env(safe-area-inset-bottom)] text-center">
        <div className="bg-white rounded-3xl shadow-xl p-8">
          <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <Store className="w-8 h-8 text-gray-400" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{name} is closed</h1>
          <p className="text-gray-600 text-sm mb-6">
            This shop is outside its hours or closed in admin. Try another vendor nearby, or check back during
            their ordering window.
          </p>
          <div className="space-y-3">
            <button
              type="button"
              onClick={onSwitchVendor}
              className="w-full bg-[#7a1d1d] text-white py-4 rounded-2xl font-bold hover:bg-[#6a1717] transition-colors"
            >
              Choose another vendor
            </button>
            {onViewOrders && (
              <button
                type="button"
                onClick={onViewOrders}
                className="w-full bg-gray-100 text-gray-700 py-3 rounded-2xl font-bold hover:bg-gray-200 transition-colors"
              >
                My orders
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
