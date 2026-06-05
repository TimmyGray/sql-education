import Box from "@mui/material/Box";
import Container from "@mui/material/Container";
import Typography from "@mui/material/Typography";

/**
 * Trivial placeholder used by skeleton route segments.
 * Wave 2 replaces these page bodies with real UI.
 */
export function PlaceholderPage({
  title,
  note,
}: {
  title: string;
  note?: string;
}): React.JSX.Element {
  return (
    <Container maxWidth="md">
      <Box sx={{ py: 8 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          {title}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {note ?? "TODO: Filled by Wave 2."}
        </Typography>
      </Box>
    </Container>
  );
}

export default PlaceholderPage;
