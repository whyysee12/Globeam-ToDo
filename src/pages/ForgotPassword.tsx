import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '../components/ui/Card';
import { getResetPasswordURL } from '../lib/authConfig';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getResetPasswordURL(),
    });
    
    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
      setTimeout(() => navigate('/login'), 3000);
    }
    setLoading(false);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <span className="w-12 h-12 rounded-xl bg-brand-600 text-white flex items-center justify-center font-bold text-2xl shadow-lg shadow-brand-500/30">G</span>
          </div>
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <CardDescription>Enter your email to receive a password reset link</CardDescription>
        </CardHeader>
        
        {success ? (
          <CardContent className="space-y-4 text-center">
            <div className="p-4 bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400 rounded-lg">
              <p className="font-medium">Check your email!</p>
              <p className="text-sm mt-1">We've sent a password reset link to {email}</p>
            </div>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Redirecting to login page...
            </p>
          </CardContent>
        ) : (
          <>
            <form onSubmit={handleResetPassword}>
              <CardContent className="space-y-4">
                {error && <div className="p-3 bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400 text-sm rounded-lg">{error}</div>}
                <Input 
                  label="Email" 
                  type="email" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  required 
                  placeholder="employee@globeam.com"
                />
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <Button type="submit" className="w-full" isLoading={loading}>Send Reset Link</Button>
                <p className="text-sm text-center text-gray-500 dark:text-gray-400">
                  Remember your password? <Link to="/login" className="text-brand-600 hover:underline dark:text-brand-400">Sign In</Link>
                </p>
              </CardFooter>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
