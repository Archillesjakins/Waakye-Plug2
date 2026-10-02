import { motion } from 'motion/react';
import { Clock, Moon } from 'lucide-react';
import { toast } from 'sonner';
import { CountdownTimer } from '@/app/components/CountdownTimer';
import { formatPlatformCloseTimeLabel } from '@/app/utils/timeUtils';

interface ClosedScreenProps {
  timeUntilOpen: number;
  onViewOrders?: () => void;
}

export function ClosedScreen({ timeUntilOpen, onViewOrders }: ClosedScreenProps) {
  const closeLabel = formatPlatformCloseTimeLabel();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="min-h-[100dvh] bg-[#fefaf4] flex items-center justify-center px-4 py-6 [webkit-tap-highlight-color:transparent]"
    >
      <div className="max-w-md w-full pb-[env(safe-area-inset-bottom)]">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-3xl shadow-xl overflow-hidden p-8 text-center will-change-transform"
        >
          <div className="mb-6 relative h-40 flex items-center justify-center bg-[#7a1d1d]/10 rounded-2xl">
            <Moon className="w-20 h-20 text-[#7a1d1d]/70" />
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">We&apos;re closed for tonight</h1>

          <p className="text-gray-600 mb-6 text-sm">
            Waakye Plug stops taking new orders at <span className="font-bold">{closeLabel}</span>. Vendors set
            their own open/closed status during the day.
          </p>

          <div className="bg-[#fefaf4] rounded-2xl p-6 mb-6 border border-gray-200">
            <p className="text-sm text-gray-600 mb-2 flex items-center justify-center gap-2">
              <Clock className="w-4 h-4" />
              Opens again in
            </p>
            <CountdownTimer milliseconds={timeUntilOpen} />
          </div>

          <div className="space-y-3">
            <button
              type="button"
              onClick={() =>
                window.open('https://chat.whatsapp.com/HM1OVHvnfZr0l1WPhJPRDg', '_blank')
              }
              className="w-full bg-yellow-400 text-gray-900 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 shadow active:bg-yellow-500 transition"
            >
              Follow on WhatsApp
            </button>

            {onViewOrders && (
              <button
                type="button"
                onClick={onViewOrders}
                className="w-full bg-gray-100 text-gray-700 py-3 rounded-2xl font-bold active:bg-gray-200 transition"
              >
                View my orders
              </button>
            )}

            <button
              type="button"
              onClick={() => toast.info('Ordering opens again at midnight — see you then! 🍚')}
              className="w-full text-gray-500 py-2 text-sm font-medium"
            >
              When can I order?
            </button>
          </div>
        </motion.div>

        <div className="text-center mt-6 text-sm text-gray-600 select-none">
          <p className="font-bold text-[#7a1d1d]">Waakye Plug</p>
        </div>
      </div>
    </motion.div>
  );
}
