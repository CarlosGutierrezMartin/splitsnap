import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Camera, Users, CreditCard, ChevronRight, ChevronLeft } from 'lucide-react';
import { Button } from './Button';

interface OnboardingViewProps {
    onComplete: () => void;
}

const slides = [
    {
        icon: Camera,
        title: 'Scan Your Receipt',
        description: 'Take a photo of any receipt and our AI will instantly extract all items with prices.',
        color: 'from-blue-500 to-cyan-400',
    },
    {
        icon: Users,
        title: 'Split with Friends',
        description: 'Share a code with your group. Everyone claims their items in real-time.',
        color: 'from-purple-500 to-pink-400',
    },
    {
        icon: CreditCard,
        title: 'Settle Up Easily',
        description: 'See exactly what everyone owes. No more awkward money conversations.',
        color: 'from-emerald-500 to-teal-400',
    },
];

const slideVariants = {
    enter: (direction: number) => ({
        x: direction > 0 ? 300 : -300,
        opacity: 0,
    }),
    center: {
        x: 0,
        opacity: 1,
    },
    exit: (direction: number) => ({
        x: direction < 0 ? 300 : -300,
        opacity: 0,
    }),
};

export const OnboardingView: React.FC<OnboardingViewProps> = ({ onComplete }) => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const [direction, setDirection] = useState(0);

    const nextSlide = () => {
        if (currentSlide < slides.length - 1) {
            setDirection(1);
            setCurrentSlide(currentSlide + 1);
        } else {
            onComplete();
        }
    };

    const prevSlide = () => {
        if (currentSlide > 0) {
            setDirection(-1);
            setCurrentSlide(currentSlide - 1);
        }
    };

    const goToSlide = (index: number) => {
        setDirection(index > currentSlide ? 1 : -1);
        setCurrentSlide(index);
    };

    const slide = slides[currentSlide];
    const Icon = slide.icon;

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 flex flex-col">
            {/* Skip button */}
            <div className="flex justify-end p-4">
                <button
                    onClick={onComplete}
                    className="text-gray-400 hover:text-gray-600 text-sm font-medium transition-colors"
                >
                    Skip
                </button>
            </div>

            {/* Main content */}
            <div className="flex-1 flex flex-col items-center justify-center px-8 pb-8">
                <AnimatePresence mode="wait" custom={direction}>
                    <motion.div
                        key={currentSlide}
                        custom={direction}
                        variants={slideVariants}
                        initial="enter"
                        animate="center"
                        exit="exit"
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="flex flex-col items-center text-center"
                    >
                        {/* Icon */}
                        <motion.div
                            initial={{ scale: 0.8, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            transition={{ delay: 0.1 }}
                            className={`w-28 h-28 rounded-3xl bg-gradient-to-br ${slide.color} flex items-center justify-center shadow-2xl mb-10`}
                        >
                            <Icon className="w-14 h-14 text-white" strokeWidth={1.5} />
                        </motion.div>

                        {/* Title */}
                        <motion.h1
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.2 }}
                            className="text-3xl font-black text-gray-900 mb-4"
                        >
                            {slide.title}
                        </motion.h1>

                        {/* Description */}
                        <motion.p
                            initial={{ y: 20, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            transition={{ delay: 0.3 }}
                            className="text-gray-500 text-lg max-w-sm leading-relaxed"
                        >
                            {slide.description}
                        </motion.p>
                    </motion.div>
                </AnimatePresence>
            </div>

            {/* Bottom controls */}
            <div className="px-8 pb-12">
                {/* Dots indicator */}
                <div className="flex justify-center gap-2 mb-8">
                    {slides.map((_, index) => (
                        <button
                            key={index}
                            onClick={() => goToSlide(index)}
                            className={`h-2 rounded-full transition-all duration-300 ${index === currentSlide
                                    ? 'w-8 bg-primary'
                                    : 'w-2 bg-gray-300 hover:bg-gray-400'
                                }`}
                        />
                    ))}
                </div>

                {/* Navigation buttons */}
                <div className="flex gap-4">
                    {currentSlide > 0 && (
                        <motion.button
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            onClick={prevSlide}
                            className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
                        >
                            <ChevronLeft className="w-6 h-6" />
                        </motion.button>
                    )}

                    <Button
                        onClick={nextSlide}
                        fullWidth
                        className="h-14 text-lg font-semibold"
                    >
                        {currentSlide === slides.length - 1 ? (
                            'Get Started'
                        ) : (
                            <>
                                Continue
                                <ChevronRight className="w-5 h-5 ml-2" />
                            </>
                        )}
                    </Button>
                </div>
            </div>
        </div>
    );
};
