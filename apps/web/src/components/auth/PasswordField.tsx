"use client";

import * as React from "react";
import TextField, { type TextFieldProps } from "@mui/material/TextField";
import IconButton from "@mui/material/IconButton";
import InputAdornment from "@mui/material/InputAdornment";
import Visibility from "@mui/icons-material/Visibility";
import VisibilityOff from "@mui/icons-material/VisibilityOff";

/**
 * Password TextField with an accessible show/hide toggle. Forwards a ref and
 * all TextField props so it drops straight into react-hook-form's `register`.
 */
export const PasswordField = React.forwardRef<
  HTMLInputElement,
  Omit<TextFieldProps, "type">
>(function PasswordField(props, ref): React.JSX.Element {
  const [visible, setVisible] = React.useState(false);

  return (
    <TextField
      {...props}
      inputRef={ref}
      type={visible ? "text" : "password"}
      slotProps={{
        ...props.slotProps,
        input: {
          ...props.slotProps?.input,
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label={visible ? "Hide password" : "Show password"}
                onClick={() => setVisible((v) => !v)}
                onMouseDown={(e) => e.preventDefault()}
                edge="end"
                size="small"
              >
                {visible ? (
                  <VisibilityOff fontSize="small" />
                ) : (
                  <Visibility fontSize="small" />
                )}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
});

export default PasswordField;
