'use client';

import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-background text-foreground text-right">
      <Logo className="w-48 h-24 mb-8" />
      <h1 className="text-4xl font-bold mb-2">404 - העמוד לא נמצא</h1>
      <p className="text-muted-foreground mb-8 text-center">מצטערים, נראה שהגעת לעמוד שאינו קיים או שחלה שגיאת טעינה.</p>
      <Button asChild>
        <Link href="/">
          חזרה לדף הבית
          <ArrowRight className="ml-2 h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
