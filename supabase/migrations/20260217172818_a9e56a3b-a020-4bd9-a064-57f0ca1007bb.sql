
-- Add RLS policy so admins can SELECT all user_roles
CREATE POLICY "Admins can select all user roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Add RLS policy so admins can INSERT user roles
CREATE POLICY "Admins can insert user roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Add RLS policy so admins can UPDATE user roles
CREATE POLICY "Admins can update user roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Add RLS policy so admins can DELETE user roles
CREATE POLICY "Admins can delete user roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
