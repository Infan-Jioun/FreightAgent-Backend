import { envConfig } from "./_config/env";
import app from "./app";

app.listen(envConfig.PORT, () => {
    console.log(`Server is running on port ${envConfig.PORT} in ${envConfig.NODE_ENV} mode`);
})