<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * S16.2: help centre. Topics are written by admins in en/fr/rw/sw and tagged
 * with services and trip contexts (charged_wrong, driver_behaviour, lost_item…)
 * so a trip detail can show the relevant ones.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('help_topics', function (Blueprint $table) {
            $table->id();
            $table->string('slug', 80)->unique();
            $table->json('title');        // {en, fr, rw, sw}
            $table->json('body');         // {en, fr, rw, sw}
            $table->json('services');     // [] = every service
            $table->json('contexts');     // e.g. ["charged_wrong"]
            $table->unsignedSmallInteger('sort')->default(100);
            $table->boolean('published')->default(true);
            $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        $now = now();
        foreach (self::topics() as $i => [$slug, $services, $contexts, $title, $body]) {
            DB::table('help_topics')->insert([
                'slug' => $slug, 'title' => json_encode($title, JSON_UNESCAPED_UNICODE), 'body' => json_encode($body, JSON_UNESCAPED_UNICODE),
                'services' => json_encode($services), 'contexts' => json_encode($contexts),
                'sort' => ($i + 1) * 10, 'published' => true, 'created_at' => $now, 'updated_at' => $now,
            ]);
        }

        $this->grant('use-support', 'Read help topics and contact Jali support', ['superadmin', 'admin', 'user', 'driver']);
        $this->grant('manage-support', 'Write help topics and answer support tickets', ['superadmin', 'admin']);
    }

    private function grant(string $name, string $description, array $roles): void
    {
        DB::table('permissions')->updateOrInsert(
            ['name' => $name],
            ['description' => $description, 'category' => 'Support', 'created_at' => now(), 'updated_at' => now()]
        );
        $permissionId = DB::table('permissions')->where('name', $name)->value('id');
        foreach (DB::table('roles')->whereIn('name', $roles)->pluck('id') as $roleId) {
            DB::table('role_permissions')->insertOrIgnore(['role_id' => $roleId, 'permission_id' => $permissionId]);
        }
    }

    /** Starter topics; admins edit them in the app. */
    private static function topics(): array
    {
        return [
            ['charged-wrong', ['rides', 'hire'], ['charged_wrong'],
                ['en' => 'I was charged the wrong amount', 'fr' => 'Le montant facturé est incorrect', 'rw' => 'Nishyuzwe amafaranga atari yo', 'sw' => 'Nimetozwa kiasi kisicho sahihi'],
                ['en' => "Your price is locked when you request, and Jali charges no fees. The final price only changes for waiting time, extra stops or overtime, and the receipt shows each part.\n\nIf the driver asked for more than the receipt, or you paid twice, open a ticket from the trip and we will check it with the driver.",
                 'fr' => "Le prix est fixé au moment de la demande et Jali ne prend aucun frais. Le prix final ne change que pour l'attente, des arrêts en plus ou des heures supplémentaires ; le reçu détaille chaque partie.\n\nSi le chauffeur a demandé plus que le reçu, ou si vous avez payé deux fois, ouvrez un ticket depuis le trajet.",
                 'rw' => "Igiciro gishyirwaho iyo usabye urugendo, kandi Jali ntiyaka amafaranga y'inyongera. Igiciro cya nyuma gihinduka gusa kubera gutegereza, guhagarara ahandi cyangwa amasaha y'inyongera; inyemezabwishyu igaragaza buri gice.\n\nNiba umushoferi yaguciye arenze ari ku nyemezabwishyu, cyangwa wishyuye kabiri, fungura ikibazo uhereye ku rugendo.",
                 'sw' => "Bei inafungwa unapoomba safari, na Jali haitozi ada yoyote. Bei ya mwisho hubadilika tu kwa muda wa kusubiri, vituo vya ziada au saa za ziada; risiti inaonyesha kila sehemu.\n\nIkiwa dereva aliomba zaidi ya risiti, au ulilipa mara mbili, fungua tiketi kutoka kwenye safari."]],
            ['driver-behaviour', ['rides', 'hire'], ['driver_behaviour', 'safety'],
                ['en' => 'A driver behaved badly', 'fr' => 'Un chauffeur s\'est mal comporté', 'rw' => 'Umushoferi yitwaye nabi', 'sw' => 'Dereva alikuwa na tabia mbaya'],
                ['en' => "Rate the trip and pick what went wrong — low ratings are reviewed by our team. If you felt unsafe, use SOS during a trip or open a safety ticket: safety tickets are answered first.",
                 'fr' => "Notez le trajet et indiquez le problème — les mauvaises notes sont examinées par notre équipe. Si vous ne vous êtes pas senti en sécurité, utilisez SOS pendant le trajet ou ouvrez un ticket sécurité : ils sont traités en priorité.",
                 'rw' => "Tanga amanota ku rugendo kandi uhitemo ikitagenze neza — amanota make asuzumwa n'itsinda ryacu. Niba utumvise utekanye, koresha SOS mu rugendo cyangwa ufungure ikibazo cy'umutekano: bikemurwa mbere.",
                 'sw' => "Kadiria safari na uchague kilichoharibika — alama za chini hukaguliwa na timu yetu. Ikiwa hukujisikia salama, tumia SOS wakati wa safari au fungua tiketi ya usalama: hujibiwa kwanza."]],
            ['lost-item', ['rides', 'hire', 'rental', 'shared', 'bus'], ['lost_item'],
                ['en' => 'I left something behind', 'fr' => 'J\'ai oublié un objet', 'rw' => 'Nasizemo ikintu', 'sw' => 'Nimesahau kitu'],
                ['en' => "Open the trip and call or message the driver while the trip is recent. If you can't reach them, open a lost-item ticket from the trip and tell us what you lost.",
                 'fr' => "Ouvrez le trajet et appelez ou écrivez au chauffeur tant que le trajet est récent. Si vous ne le joignez pas, ouvrez un ticket « objet perdu » depuis le trajet.",
                 'rw' => "Fungura urugendo uhamagare cyangwa wandikire umushoferi urugendo rukiri vuba. Niba utamubonye, fungura ikibazo cy'ikintu cyatakaye uhereye ku rugendo.",
                 'sw' => "Fungua safari na umpigie au umwandikie dereva safari ikiwa bado ni ya hivi karibuni. Usipompata, fungua tiketi ya kitu kilichopotea kutoka kwenye safari."]],
            ['cancel-and-refunds', [], ['cancel'],
                ['en' => 'Cancelling and refunds', 'fr' => 'Annulation et remboursements', 'rw' => 'Guhagarika no gusubizwa amafaranga', 'sw' => 'Kughairi na kurejeshewa pesa'],
                ['en' => "Rides are free to cancel until the driver has waited longer than the free waiting time. Hires and rentals follow the cancellation rule shown before you book. Bus tickets cancelled more than 24 hours before departure are refunded.",
                 'fr' => "Une course est annulable sans frais tant que le chauffeur n'a pas attendu plus que le temps gratuit. Les locations et réservations de chauffeur suivent la règle affichée avant la réservation. Les billets de bus annulés plus de 24 h avant le départ sont remboursés.",
                 'rw' => "Urugendo rushobora guhagarikwa nta kiguzi kugeza umushoferi amaze gutegereza igihe kirenze icy'ubuntu. Gukodesha imodoka cyangwa umushoferi bikurikiza amategeko yerekanwa mbere yo kubika. Amatike ya bisi ahagaritswe amasaha 24 mbere yo kugenda arasubizwa.",
                 'sw' => "Safari inaweza kughairiwa bure hadi dereva asubiri zaidi ya muda wa bure. Kukodi gari au dereva hufuata sheria inayoonyeshwa kabla ya kuweka nafasi. Tiketi za basi zilizoghairiwa zaidi ya saa 24 kabla ya kuondoka hurejeshewa pesa."]],
            ['rental-damage-deposit', ['rental'], ['damage', 'charged_wrong'],
                ['en' => 'Rental damage and deposit', 'fr' => 'Dommages et caution de location', 'rw' => 'Ibyangiritse n\'ingwate mu gukodesha', 'sw' => 'Uharibifu na amana ya kukodi'],
                ['en' => "Take photos at handover and return — they are saved on the rental. If the owner keeps part of the deposit for damage you did not cause, open a ticket from the rental and we will compare the photos.",
                 'fr' => "Prenez des photos à la remise et au retour — elles sont enregistrées sur la location. Si le propriétaire retient une partie de la caution pour un dommage que vous n'avez pas causé, ouvrez un ticket depuis la location.",
                 'rw' => "Fata amafoto igihe uhabwa imodoka n'igihe uyisubiza — abikwa ku bukode. Niba nyir'imodoka afashe igice cy'ingwate kubera ibyangiritse utateje, fungura ikibazo uhereye ku bukode.",
                 'sw' => "Piga picha wakati wa kukabidhiwa na kurudisha — zinahifadhiwa kwenye ukodishaji. Ikiwa mmiliki atazuia sehemu ya amana kwa uharibifu ambao hukusababisha, fungua tiketi kutoka kwenye ukodishaji."]],
            ['account-and-data', [], ['account'],
                ['en' => 'My account and data', 'fr' => 'Mon compte et mes données', 'rw' => 'Konti yanjye n\'amakuru yanjye', 'sw' => 'Akaunti yangu na data'],
                ['en' => "Change your name, photo and language in Account. You can delete your account there too; trips you took stay in our records as the law requires, without your contact details.",
                 'fr' => "Modifiez nom, photo et langue dans Compte. Vous pouvez aussi y supprimer votre compte ; vos trajets restent dans nos registres comme l'exige la loi, sans vos coordonnées.",
                 'rw' => "Hindura izina, ifoto n'ururimi muri Konti. Ushobora no gusiba konti yawe aho; ingendo wakoze ziguma mu nyandiko zacu nk'uko amategeko abisaba, nta makuru yo kukuvugisha.",
                 'sw' => "Badilisha jina, picha na lugha katika Akaunti. Unaweza pia kufuta akaunti yako hapo; safari ulizofanya zinabaki kwenye kumbukumbu zetu kama sheria inavyotaka, bila maelezo yako ya mawasiliano."]],
        ];
    }

    public function down(): void
    {
        Schema::dropIfExists('help_topics');
        DB::table('permissions')->whereIn('name', ['use-support', 'manage-support'])->delete();
    }
};
