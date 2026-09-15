import { motion } from "motion/react";
import { Clock } from "lucide-react";
import { toast } from "sonner";
import { CountdownTimer } from "@/app/components/CountdownTimer";
import { ImageWithFallback } from "@/app/components/figma/ImageWithFallback";

interface ClosedScreenProps {
  timeUntilOpen: number;
}

export function ClosedScreen({ timeUntilOpen }: ClosedScreenProps) {
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
          {/* Sunrise Illustration */}
          <div className="mb-6 relative h-48 overflow-hidden">
            <ImageWithFallback
              src="https://i.pinimg.com/1200x/65/95/8c/65958c40aeb6ed8023c8b491572276bf.jpg"
              alt="Sunrise"
              className="w-full h-full object-cover rounded-2xl opacity-80"
            />
            <div className="absolute inset-0 flex items-center justify-center">
              <Clock className="w-24 h-24 text-white drop-shadow-lg" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Get ready to get served tomorrow 🌅
          </h1>

          <p className="text-gray-600 mb-6">
            Pre-orders starts at <span className="font-bold">5:00 PM</span>
          </p>

          {/* Countdown to Next Opening */}
          <div className="bg-[#fefaf4] rounded-2xl p-6 mb-6 border border-gray-200">
            <p className="text-sm text-gray-600 mb-2">Opens in</p>
            <CountdownTimer milliseconds={timeUntilOpen} />
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={() =>
                window.open(
                  "https://chat.whatsapp.com/HM1OVHvnfZr0l1WPhJPRDg",
                  "_blank",
                )
              }
              className="w-full bg-yellow-400 text-gray-900 py-5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow active:bg-yellow-500 transition"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12.206.793c.99 0 4.347.276 5.93 3.821.529 1.193.403 3.219.299 4.847l-.003.06c-.012.18-.022.345-.03.51.075.045.203.09.401.09.3-.016.659-.12 1.033-.301.165-.088.344-.104.464-.104.182 0 .359.029.509.09.45.149.734.479.734.838 0 .149-.06.42-.585.719-.585.319-1.34.483-2.198.483-.12 0-.24-.008-.359-.016-.254-.022-.494-.045-.734-.045-.27 0-.411.03-.465.046-.09.03-.135.091-.135.15 0 .045.015.09.045.119l.015.015c.12.135 1.064.824 1.544 1.244.494.42 1.006.959 1.424 1.589.405.614.645 1.244.645 1.694 0 .359-.135.629-.359.749-.09.045-.226.075-.359.075-.254 0-.569-.135-1.064-.569-.449-.404-.884-.959-1.289-1.634-.314-.539-.584-1.096-.734-1.514-.074-.21-.164-.344-.284-.449a.546.546 0 0 0-.345-.12c-.12 0-.226.045-.329.135-.21.18-.359.525-.359 1.109 0 .584.105 1.259.21 1.873.09.495.18 1.006.18 1.424 0 .314-.045.584-.149.779-.135.24-.359.359-.644.359-.195 0-.389-.06-.584-.12-.494-.149-.989-.524-1.469-1.079-.404-.464-.734-1.019-1.006-1.514-.21-.359-.345-.644-.449-.824-.045-.074-.074-.119-.09-.149a.289.289 0 0 0-.195-.089c-.09 0-.18.029-.27.089-.12.074-.21.21-.27.42-.074.254-.119.614-.119 1.079 0 .584.105 1.259.21 1.873.09.495.18 1.006.18 1.424 0 .314-.045.584-.149.779-.135.24-.359.359-.644.359-.195 0-.389-.06-.584-.12-.494-.149-.989-.524-1.469-1.079-.404-.464-.734-1.019-1.006-1.514-.21-.359-.345-.644-.449-.824l-.09-.149a.289.289 0 0 0-.195-.089c-.09 0-.18.029-.27.089-.12.074-.21.21-.27.42-.074.254-.119.614-.119 1.079 0 .584.105 1.259.21 1.873.09.495.18 1.006.18 1.424 0 .314-.045.584-.149.779-.135.24-.359.359-.644.359-.195 0-.389-.06-.584-.12-.494-.149-.989-.524-1.469-1.079-.404-.464-.734-1.019-1.006-1.514-.21-.359-.345-.644-.449-.824l-.09-.149a.289.289 0 0 0-.195-.089c-.09 0-.18.029-.27.089-.12.074-.21.21-.27.42-.074.254-.119.614-.119 1.079 0 .584.105 1.259.21 1.873.09.495.18 1.006.18 1.424 0 .314-.045.584-.149.779-.135.24-.359.359-.644.359-.195 0-.389-.06-.584-.12-.494-.149-.989-.524-1.469-1.079-.404-.464-.734-1.019-1.006-1.514-.21-.359-.345-.644-.449-.824-.045-.074-.074-.119-.09-.149a.289.289 0 0 0-.195-.089c-.09 0-.18.029-.27.089-.12.074-.21.21-.27.42-.074.254-.119.614-.119 1.079 0 .584.105 1.259.21 1.873.09.495.18 1.006.18 1.424 0 .584-.225 1.006-.584 1.214-.254.135-.569.21-.899.21-1.199 0-2.477-.584-3.506-1.634-.899-.914-1.544-2.063-1.544-3.177 0-.914.374-1.694.989-2.198.554-.464 1.244-.719 1.964-.719.195 0 .389.015.584.045.554.074 1.006.254 1.394.509.135.09.254.195.359.314l.105.105c.074.074.119.119.18.164.015 0 .029.015.045.015.045 0 .074-.029.104-.074.03-.06.045-.149.045-.27 0-.195-.029-.494-.074-.884-.045-.404-.09-.899-.09-1.469 0-.855.12-1.679.344-2.402.449-1.469 1.379-2.447 2.611-2.789.539-.164 1.139-.254 1.769-.254z" />
              </svg>
              Follow on WhatsApp
            </button>

            <button
              onClick={() =>
                toast.info(
                  "Tomorrow's menu drops at 5:00 PM — check back then! 🍚",
                )
              }
              className="w-full bg-gray-100 text-gray-700 py-4 rounded-2xl font-bold active:bg-gray-200 transition"
            >
              View Tomorrow's Menu
            </button>
          </div>

          {/* Social Proof */}
          <div className="mt-8 pt-6 border-t border-gray-200">
            <p className="text-sm text-gray-500 mb-3">
              Join <span className="font-bold text-[#7a1d1d]">100+</span> happy
              customers
            </p>
            <div className="flex gap-2 justify-center">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full bg-gradient-to-br from-gray-200 to-gray-300"
                />
              ))}
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <div className="text-center mt-6 text-sm text-gray-600 select-none">
          <p className="font-bold text-[#7a1d1d]">Waakye Plug</p>
          <p>See you in the morning! ☀️</p>
        </div>
      </div>
    </motion.div>
  );
}
