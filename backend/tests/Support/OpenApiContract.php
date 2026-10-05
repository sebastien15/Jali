<?php

namespace Tests\Support;

use Illuminate\Testing\TestResponse;
use Opis\JsonSchema\Errors\ErrorFormatter;
use Opis\JsonSchema\Validator;
use PHPUnit\Framework\Assert;
use Symfony\Component\Yaml\Yaml;

/**
 * Reads docs/api/openapi.yaml and checks real responses against it.
 * The spec is the source of truth (docs/api/README.md); these helpers make the
 * build fail when the backend and the contract drift apart.
 */
class OpenApiContract
{
    public const SPEC_ID = 'https://jali.rw/openapi.json';
    public const METHODS = ['get', 'post', 'put', 'patch', 'delete'];

    private static ?array $spec = null;
    private static ?Validator $validator = null;

    public static function spec(): array
    {
        return self::$spec ??= Yaml::parseFile(base_path('../docs/api/openapi.yaml'));
    }

    /** @return array<int, array{path: string, method: string, planned: bool, operation: array}> */
    public static function operations(): array
    {
        $ops = [];
        foreach (self::spec()['paths'] as $path => $item) {
            foreach (self::METHODS as $method) {
                if (isset($item[$method])) {
                    $ops[] = [
                        'path'      => $path,
                        'method'    => $method,
                        'planned'   => ($item[$method]['x-jali-status'] ?? null) === 'planned',
                        'operation' => $item[$method],
                    ];
                }
            }
        }

        return $ops;
    }

    public static function assertResponse(TestResponse $response, string $method, string $path): void
    {
        $status = (string) $response->getStatusCode();
        $operation = self::spec()['paths'][$path][$method] ?? null;
        Assert::assertNotNull($operation, "Contract has no operation $method $path");

        $responses = $operation['responses'] ?? [];
        Assert::assertArrayHasKey($status, $responses, "Contract for $method $path does not document status $status");

        // Resolve a $ref to components/responses into a JSON pointer
        $pointer = '#/paths/' . self::escape($path) . "/$method/responses/$status";
        $resp = $responses[$status];
        if (isset($resp['$ref'])) {
            $pointer = $resp['$ref'];
            $resp = self::resolve($resp['$ref']);
        }
        if (!isset($resp['content']['application/json']['schema'])) {
            return; // no body documented
        }

        $data = json_decode($response->getContent());
        $result = self::validator()->validate($data, self::SPEC_ID . $pointer . '/content/application~1json/schema');

        if (!$result->isValid()) {
            $errors = (new ErrorFormatter())->format($result->error());
            Assert::fail("Response for $method $path ($status) violates the contract:\n"
                . json_encode($errors, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES)
                . "\nBody: " . $response->getContent());
        }
        Assert::assertTrue(true);
    }

    private static function validator(): Validator
    {
        if (!self::$validator) {
            self::$validator = new Validator();
            self::$validator->setMaxErrors(10);
            self::$validator->resolver()->registerRaw(
                json_encode(self::spec(), JSON_UNESCAPED_SLASHES),
                self::SPEC_ID,
            );
        }

        return self::$validator;
    }

    private static function resolve(string $ref): array
    {
        $node = self::spec();
        foreach (explode('/', ltrim($ref, '#/')) as $part) {
            $node = $node[str_replace(['~1', '~0'], ['/', '~'], $part)];
        }

        return $node;
    }

    private static function escape(string $path): string
    {
        return str_replace(['~', '/'], ['~0', '~1'], $path);
    }
}
