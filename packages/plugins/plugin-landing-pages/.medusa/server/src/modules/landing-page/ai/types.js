"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LandingAiError = void 0;
/** Error tipado para que las rutas devuelvan el status correcto. */
class LandingAiError extends Error {
    status;
    constructor(message, status = 500) {
        super(message);
        this.name = 'LandingAiError';
        this.status = status;
    }
}
exports.LandingAiError = LandingAiError;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHlwZXMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi8uLi8uLi8uLi9zcmMvbW9kdWxlcy9sYW5kaW5nLXBhZ2UvYWkvdHlwZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBZ0RBLG9FQUFvRTtBQUNwRSxNQUFhLGNBQWUsU0FBUSxLQUFLO0lBQ3ZDLE1BQU0sQ0FBUztJQUNmLFlBQVksT0FBZSxFQUFFLE1BQU0sR0FBRyxHQUFHO1FBQ3ZDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNmLElBQUksQ0FBQyxJQUFJLEdBQUcsZ0JBQWdCLENBQUM7UUFDN0IsSUFBSSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUM7SUFDdkIsQ0FBQztDQUNGO0FBUEQsd0NBT0MifQ==