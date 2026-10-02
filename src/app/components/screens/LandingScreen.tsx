import { motion } from 'motion/react';
import { CountdownTimer } from '@/app/components/CountdownTimer';
import { ImageWithFallback } from '@/app/components/figma/ImageWithFallback';
import { ArrowRight, Clock, Soup, Croissant, Store } from 'lucide-react';
import { useVendor } from '@/app/context/VendorContext';
import { formatPlatformCloseTimeLabel } from '@/app/utils/timeUtils';

interface LandingScreenProps {
  timeUntilClose: number;
  vendorIsOpen: boolean;
  platformIsOpen: boolean;
  onStart: () => void;
  onBuild: () => void;
  onSwitchVendor: () => void;
}

function greetingForHour(hour: number): string {
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function LandingScreen({
  timeUntilClose,
  vendorIsOpen,
  platformIsOpen,
  onStart,
  onBuild,
  onSwitchVendor,
}: LandingScreenProps) {
  const { selectedVendor } = useVendor();
  const canOrder = platformIsOpen && vendorIsOpen;
  const greeting = greetingForHour(new Date().getHours());

  const closeLabel = formatPlatformCloseTimeLabel();

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="min-h-[100dvh] bg-[#fefaf4] [webkit-tap-highlight-color:transparent]"
    >
      <div className="max-w-md mx-auto pb-[calc(env(safe-area-inset-bottom)+24px)]">
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between px-5 pt-6 pb-3"
        >
          <div>
            <p className="text-xs text-gray-500">{greeting}</p>
            <p className="font-bold text-gray-900 text-lg">{selectedVendor?.business_name ?? 'Waakye Plug'}</p>
          </div>
          <div
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${
              canOrder ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${canOrder ? 'bg-green-500' : 'bg-gray-400'}`} />
            {canOrder ? 'Open for orders' : vendorIsOpen ? 'Closed for tonight' : 'Vendor closed'}
          </div>
        </motion.div>

        <div className="px-5 -mt-1 mb-2">
          <button
            type="button"
            onClick={onSwitchVendor}
            className="flex items-center gap-1.5 text-xs font-medium text-gray-400 hover:text-[#7a1d1d] transition-colors"
          >
            <Store className="w-3.5 h-3.5" />
            Switch vendor
          </button>
        </div>

        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
          className="mx-4 relative rounded-3xl overflow-hidden shadow-xl h-56"
        >
          <ImageWithFallback
            src="https://i.pinimg.com/736x/48/95/40/489540c16760f9c02b89028a5e5fd7e2.jpg"
            alt="Delicious Waakye Bowl"
            className="w-full h-full object-cover"
            loading="eager"
            decoding="async"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5">
            <p className="text-white/80 text-xs font-medium mb-1">Fresh · Delivered nearby</p>
            <p className="text-white font-bold text-xl leading-snug">
              Order from {selectedVendor?.business_name ?? 'your vendor'} — platform open until {closeLabel}
            </p>
          </div>
        </motion.div>

        {platformIsOpen && (
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="mx-4 mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <Clock className="w-4 h-4 text-amber-500" />
            </div>
            <div className="flex-1">
              <CountdownTimer milliseconds={timeUntilClose} />
              <p className="text-xs text-gray-500">Until platform closes tonight</p>
            </div>
          </motion.div>
        )}

        {!vendorIsOpen && platformIsOpen && (
          <p className="mx-4 mt-4 text-sm text-center text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            {selectedVendor?.business_name ?? 'This vendor'} is closed right now. Switch vendor or try again later.
          </p>
        )}

        <div className="px-4 mt-6">
          <p className="font-bold text-gray-900 mb-3">What are you craving?</p>
          <div className="grid grid-cols-2 gap-3">
            <motion.button
              type="button"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              whileTap={canOrder ? { scale: 0.97 } : undefined}
              onClick={canOrder ? onStart : undefined}
              disabled={!canOrder}
              className={`bg-white rounded-2xl border-2 p-4 text-left transition-colors ${
                canOrder
                  ? 'border-gray-100 hover:border-[#7a1d1d]/30'
                  : 'border-gray-100 opacity-50 cursor-not-allowed'
              }`}
            >
              <div className="w-11 h-11 rounded-xl bg-[#7a1d1d]/10 flex items-center justify-center mb-3">
                <Soup size={22} className="text-[#7a1d1d]" />
              </div>
              <p className="font-bold text-sm">Waakye Bowl</p>
              <p className="text-xs text-gray-500 mt-0.5">Browse &amp; build</p>
              <div className="flex items-center gap-1 text-[#7a1d1d] text-xs font-bold mt-3">
                {canOrder ? (
                  <>
                    Order now <ArrowRight className="w-3.5 h-3.5" />
                  </>
                ) : (
                  'Unavailable'
                )}
              </div>
            </motion.button>

            <motion.button
              type="button"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              whileTap={{ scale: 0.97 }}
              onClick={onBuild}
              className="bg-white rounded-2xl border-2 border-gray-100 p-4 text-left opacity-60"
            >
              <div className="w-11 h-11 rounded-xl bg-[#7a1d1d]/10 flex items-center justify-center mb-3">
                <Croissant size={22} className="text-[#7a1d1d]" />
              </div>
              <p className="font-bold text-sm">Breakfast</p>
              <p className="text-xs text-gray-500 mt-0.5">Jollof &amp; drinks</p>
              <div className="text-gray-400 text-xs font-bold mt-3">Coming soon</div>
            </motion.button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
